use std::{
	collections::HashMap,
	path::{Path, PathBuf},
	time::{SystemTime, UNIX_EPOCH},
};

use native_db::*;
use native_model::{native_model, Model};
use serde::{Deserialize, Serialize};
use tokio::task::spawn_blocking;

use crate::app::{index, ndb, Error};

#[derive(Clone)]
pub struct Manager {
	index_manager: index::Manager,
	db: ndb::Manager,
}

// ─── Native DB Model ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[native_model(id = 100, version = 1)]
#[native_db]
pub struct PlayRecordModel {
	#[primary_key]
	pub play_id: String,
	#[secondary_key]
	pub username: String,
	pub song_path: PathBuf,
	pub artist_names: Vec<String>,
	pub album_name: String,
	pub album_artists: Vec<String>,
	pub played_at: SystemTime,
}

// ─── Public types ──────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct ArtistPlayCount {
	pub name: String,
	pub play_count: u32,
	#[allow(dead_code)]
	pub last_played: SystemTime,
}

#[derive(Debug)]
pub struct ArtistLastPlayed {
	pub name: String,
	pub last_played: SystemTime,
}

// ─── Manager ───────────────────────────────────────────────────────────────

impl Manager {
	pub fn new(index_manager: index::Manager, db: ndb::Manager) -> Self {
		Self { index_manager, db }
	}

	/// Record a play when a song finishes playing.
	pub async fn record_play(&self, username: &str, song_path: &Path) -> Result<(), Error> {
		let song_result = self.index_manager.get_song(song_path.to_path_buf()).await;
		let (artist_names, album_name, album_artists) = match &song_result {
			Ok(song) => (
				song.artists.clone(),
				song.album.clone().unwrap_or_default(),
				song.album_artists.clone(),
			),
			Err(_) => (Vec::new(), String::new(), Vec::new()),
		};

		let record = PlayRecordModel {
			username: username.to_owned(),
			play_id: format!(
				"{}-{}",
				username,
				SystemTime::now()
					.duration_since(UNIX_EPOCH)
					.unwrap_or_default()
					.as_nanos()
			),
			song_path: song_path.to_path_buf(),
			artist_names,
			album_name,
			album_artists,
			played_at: SystemTime::now(),
		};

		spawn_blocking({
			let manager = self.clone();
			move || -> Result<(), Box<native_db::db_type::Error>> {
				let transaction = manager.db.rw_transaction()?;
				transaction.upsert::<PlayRecordModel>(record)?;
				transaction.commit()?;
				Ok(())
			}
		})
		.await?
		.map_err(Error::NativeDatabase)
	}

	/// Get recent plays for a user.
	#[allow(dead_code)]
	pub async fn get_recent_plays(
		&self,
		username: &str,
		limit: usize,
	) -> Result<Vec<PlayRecordModel>, Error> {
		spawn_blocking({
			let manager = self.clone();
			let username = username.to_owned();
			move || -> Result<Vec<PlayRecordModel>, Box<native_db::db_type::Error>> {
				let transaction = manager.db.r_transaction()?;
				let mut records = transaction
					.scan()
					.secondary::<PlayRecordModel>(PlayRecordModelKey::username)?
					.range(username.as_str()..=username.as_str())?
					.filter_map(|r| r.ok())
					.collect::<Vec<_>>();

				records.sort_by_key(|b| std::cmp::Reverse(b.played_at));
				records.truncate(limit);
				Ok(records)
			}
		})
		.await?
		.map_err(Error::NativeDatabase)
	}

	/// Get play counts per artist (computed on demand from raw records).
	pub async fn get_artist_play_counts(
		&self,
		username: &str,
	) -> Result<Vec<ArtistPlayCount>, Error> {
		spawn_blocking({
			let manager = self.clone();
			let username = username.to_owned();
			move || -> Result<Vec<ArtistPlayCount>, Box<native_db::db_type::Error>> {
				let transaction = manager.db.r_transaction()?;
				let records = transaction
					.scan()
					.secondary::<PlayRecordModel>(PlayRecordModelKey::username)?
					.range(username.as_str()..=username.as_str())?
					.filter_map(|r| r.ok())
					.collect::<Vec<_>>();

				let mut map: HashMap<String, (u32, SystemTime)> = HashMap::new();
				for record in records {
					for artist in &record.artist_names {
						let entry = map.entry(artist.clone()).or_insert((0, record.played_at));
						entry.0 += 1;
						if record.played_at > entry.1 {
							entry.1 = record.played_at;
						}
					}
				}

				Ok(map
					.into_iter()
					.map(|(name, (count, last))| ArtistPlayCount {
						name,
						play_count: count,
						last_played: last,
					})
					.collect())
			}
		})
		.await?
		.map_err(Error::NativeDatabase)
	}

	/// Get last-played timestamps per artist (computed on demand).
	pub async fn get_artist_recently_played(
		&self,
		username: &str,
	) -> Result<Vec<ArtistLastPlayed>, Error> {
		spawn_blocking({
			let manager = self.clone();
			let username = username.to_owned();
			move || -> Result<Vec<ArtistLastPlayed>, Box<native_db::db_type::Error>> {
				let transaction = manager.db.r_transaction()?;
				let records = transaction
					.scan()
					.secondary::<PlayRecordModel>(PlayRecordModelKey::username)?
					.range(username.as_str()..=username.as_str())?
					.filter_map(|r| r.ok())
					.collect::<Vec<_>>();

				let mut map: HashMap<String, SystemTime> = HashMap::new();
				for record in records {
					for artist in &record.artist_names {
						let entry = map.entry(artist.clone());
						entry
							.and_modify(|last| {
								if record.played_at > *last {
									*last = record.played_at;
								}
							})
							.or_insert(record.played_at);
					}
				}

				Ok(map
					.into_iter()
					.map(|(name, last)| ArtistLastPlayed {
						name,
						last_played: last,
					})
					.collect())
			}
		})
		.await?
		.map_err(Error::NativeDatabase)
	}

	/// Remove play records for a song that was deleted from the library.
	#[allow(dead_code)]
	pub async fn cleanup_removed_song(&self, song_path: &Path) -> Result<usize, Error> {
		spawn_blocking({
			let manager = self.clone();
			let song_path = song_path.to_path_buf();
			move || -> Result<usize, Box<native_db::db_type::Error>> {
				let transaction = manager.db.rw_transaction()?;
				let all_records = transaction
					.scan()
					.primary::<PlayRecordModel>()?
					.all()?
					.filter_map(|r| r.ok())
					.collect::<Vec<_>>();

				let mut removed = 0;
				for record in all_records {
					if record.song_path == song_path {
						transaction.remove::<PlayRecordModel>(record)?;
						removed += 1;
					}
				}

				transaction.commit()?;
				Ok(removed)
			}
		})
		.await?
		.map_err(Error::NativeDatabase)
	}

	/// Remove play records older than the given number of days.
	#[allow(dead_code)]
	pub async fn cleanup_old_records(&self, days_to_keep: u32) -> Result<usize, Error> {
		let cutoff = SystemTime::now()
			.checked_sub(std::time::Duration::from_secs(days_to_keep as u64 * 86400))
			.unwrap_or(UNIX_EPOCH);

		spawn_blocking({
			let manager = self.clone();
			move || -> Result<usize, Box<native_db::db_type::Error>> {
				let transaction = manager.db.rw_transaction()?;
				let all_records = transaction
					.scan()
					.primary::<PlayRecordModel>()?
					.all()?
					.filter_map(|r| r.ok())
					.collect::<Vec<_>>();

				let mut removed = 0;
				for record in all_records {
					if record.played_at < cutoff {
						transaction.remove::<PlayRecordModel>(record)?;
						removed += 1;
					}
				}

				transaction.commit()?;
				Ok(removed)
			}
		})
		.await?
		.map_err(Error::NativeDatabase)
	}
}

#[cfg(test)]
mod test {
	use std::path::Path;

	use crate::app::test::ContextBuilder;
	use crate::test_name;

	const TEST_USER: &str = "alice";
	const TEST_PASSWORD: &str = "password";
	const TEST_MOUNT_NAME: &str = "root";

	fn song_path(name: &str) -> &Path {
		Path::new(name)
	}

	#[tokio::test]
	async fn record_play_golden_path() {
		let ctx = ContextBuilder::new(test_name!())
			.user(TEST_USER, TEST_PASSWORD, true)
			.mount(TEST_MOUNT_NAME, "test-data/small-collection")
			.build()
			.await;

		ctx.scanner.run_scan().await.unwrap();

		let path = song_path("root/Khemmis/Hunted/01 - Above The Water.mp3");
		ctx.play_stats_manager
			.record_play(TEST_USER, path)
			.await
			.unwrap();

		let plays = ctx
			.play_stats_manager
			.get_recent_plays(TEST_USER, 10)
			.await
			.unwrap();
		assert_eq!(plays.len(), 1);
		assert_eq!(plays[0].song_path, path);
		assert_eq!(plays[0].username, TEST_USER);
	}

	#[tokio::test]
	async fn get_artist_play_counts_aggregates() {
		let ctx = ContextBuilder::new(test_name!())
			.user(TEST_USER, TEST_PASSWORD, true)
			.mount(TEST_MOUNT_NAME, "test-data/small-collection")
			.build()
			.await;

		ctx.scanner.run_scan().await.unwrap();

		let songs = [
			"root/Khemmis/Hunted/01 - Above The Water.mp3",
			"root/Khemmis/Hunted/02 - Candlelight.mp3",
			"root/Khemmis/Hunted/03 - Three Gates.mp3",
		];
		for s in &songs {
			ctx.play_stats_manager
				.record_play(TEST_USER, Path::new(s))
				.await
				.unwrap();
		}

		let stats = ctx
			.play_stats_manager
			.get_artist_play_counts(TEST_USER)
			.await
			.unwrap();
		let khemmis = stats.iter().find(|s| s.name == "Khemmis").unwrap();
		assert_eq!(khemmis.play_count, 3);
	}

	#[tokio::test]
	async fn get_artist_play_counts_per_user() {
		let ctx = ContextBuilder::new(test_name!())
			.user(TEST_USER, TEST_PASSWORD, true)
			.user("bob", "password", false)
			.mount(TEST_MOUNT_NAME, "test-data/small-collection")
			.build()
			.await;

		ctx.scanner.run_scan().await.unwrap();

		let path = song_path("root/Khemmis/Hunted/01 - Above The Water.mp3");
		ctx.play_stats_manager
			.record_play(TEST_USER, path)
			.await
			.unwrap();
		ctx.play_stats_manager
			.record_play(TEST_USER, path)
			.await
			.unwrap();
		ctx.play_stats_manager
			.record_play("bob", path)
			.await
			.unwrap();

		let alice_stats = ctx
			.play_stats_manager
			.get_artist_play_counts(TEST_USER)
			.await
			.unwrap();
		let bob_stats = ctx
			.play_stats_manager
			.get_artist_play_counts("bob")
			.await
			.unwrap();

		let alice_khemmis = alice_stats.iter().find(|s| s.name == "Khemmis").unwrap();
		let bob_khemmis = bob_stats.iter().find(|s| s.name == "Khemmis").unwrap();

		assert_eq!(alice_khemmis.play_count, 2);
		assert_eq!(bob_khemmis.play_count, 1);
	}

	#[tokio::test]
	async fn get_artist_recently_played() {
		let ctx = ContextBuilder::new(test_name!())
			.user(TEST_USER, TEST_PASSWORD, true)
			.mount(TEST_MOUNT_NAME, "test-data/small-collection")
			.build()
			.await;

		ctx.scanner.run_scan().await.unwrap();

		let path_a = song_path("root/Khemmis/Hunted/01 - Above The Water.mp3");
		let path_b = song_path("root/Tobokegao/Picnic/01 - ピクニック (Picnic).mp3");

		ctx.play_stats_manager
			.record_play(TEST_USER, path_a)
			.await
			.unwrap();
		tokio::time::sleep(std::time::Duration::from_millis(10)).await;
		ctx.play_stats_manager
			.record_play(TEST_USER, path_b)
			.await
			.unwrap();

		let stats = ctx
			.play_stats_manager
			.get_artist_recently_played(TEST_USER)
			.await
			.unwrap();
		let khemmis = stats.iter().find(|s| s.name == "Khemmis").unwrap();
		let tobokegao = stats.iter().find(|s| s.name == "Tobokegao").unwrap();

		assert!(tobokegao.last_played > khemmis.last_played);
	}

	#[tokio::test]
	async fn cleanup_removed_song() {
		let ctx = ContextBuilder::new(test_name!())
			.user(TEST_USER, TEST_PASSWORD, true)
			.mount(TEST_MOUNT_NAME, "test-data/small-collection")
			.build()
			.await;

		ctx.scanner.run_scan().await.unwrap();

		let path = song_path("root/Khemmis/Hunted/01 - Above The Water.mp3");
		ctx.play_stats_manager
			.record_play(TEST_USER, path)
			.await
			.unwrap();

		let plays = ctx
			.play_stats_manager
			.get_recent_plays(TEST_USER, 10)
			.await
			.unwrap();
		assert_eq!(plays.len(), 1);

		let removed = ctx
			.play_stats_manager
			.cleanup_removed_song(path)
			.await
			.unwrap();
		assert_eq!(removed, 1);

		let plays = ctx
			.play_stats_manager
			.get_recent_plays(TEST_USER, 10)
			.await
			.unwrap();
		assert!(plays.is_empty());
	}

	#[tokio::test]
	async fn cleanup_old_records() {
		let ctx = ContextBuilder::new(test_name!())
			.user(TEST_USER, TEST_PASSWORD, true)
			.mount(TEST_MOUNT_NAME, "test-data/small-collection")
			.build()
			.await;

		ctx.scanner.run_scan().await.unwrap();

		let path = song_path("root/Khemmis/Hunted/01 - Above The Water.mp3");
		ctx.play_stats_manager
			.record_play(TEST_USER, path)
			.await
			.unwrap();

		let removed = ctx.play_stats_manager.cleanup_old_records(0).await.unwrap();
		assert_eq!(removed, 1);

		let plays = ctx
			.play_stats_manager
			.get_recent_plays(TEST_USER, 10)
			.await
			.unwrap();
		assert!(plays.is_empty());
	}
}
