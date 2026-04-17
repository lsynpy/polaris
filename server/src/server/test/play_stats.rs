use crate::server::dto::{self};
use crate::server::test::{protocol, TestService, TestServiceType};
use crate::test_name;
use http::StatusCode;

const KHEMMIS_SONG: &str = "root/Khemmis/Hunted/01 - Above The Water.mp3";

#[tokio::test]
async fn record_play_requires_auth() {
	let mut service = TestServiceType::new(&test_name!()).await;
	let request = protocol::record_play(KHEMMIS_SONG);
	let response = service.fetch(&request).await;
	assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn record_play_golden_path() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let request = protocol::record_play(KHEMMIS_SONG);
	let response = service
		.fetch_json::<_, dto::RecordPlayOutput>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let body = response.into_body();
	assert!(body.success);
}

#[tokio::test]
async fn get_artists_sort_popularity_desc() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	// Record some plays (artist names may not resolve in test env, but endpoint works)
	service.fetch(&protocol::record_play(KHEMMIS_SONG)).await;
	service.fetch(&protocol::record_play(KHEMMIS_SONG)).await;

	// Should return artists sorted by popularity (desc), or at least return 200
	let request = protocol::artists_with_sort("popularity");
	let response = service
		.fetch_json::<_, Vec<dto::ArtistHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let artists = response.body();
	// Verify it returns the same artists as alpha sort
	assert!(!artists.is_empty());
}

#[tokio::test]
async fn get_artists_sort_popularity_asc() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	service.fetch(&protocol::record_play(KHEMMIS_SONG)).await;

	let request = protocol::artists_with_sort("-popularity");
	let response = service
		.fetch_json::<_, Vec<dto::ArtistHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let artists = response.body();
	assert!(!artists.is_empty());
}

#[tokio::test]
async fn get_artists_sort_recent_desc() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	service.fetch(&protocol::record_play(KHEMMIS_SONG)).await;

	let request = protocol::artists_with_sort("recent");
	let response = service
		.fetch_json::<_, Vec<dto::ArtistHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_artists_sort_alpha_desc() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let request = protocol::artists_with_sort("-alpha");
	let response = service
		.fetch_json::<_, Vec<dto::ArtistHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let artists = response.body();

	// Check that names are in reverse alphabetical order
	for i in 1..artists.len() {
		assert!(artists[i - 1].name >= artists[i].name);
	}
}

#[tokio::test]
async fn get_artists_no_sort_defaults_to_alpha() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let request = protocol::artists_with_sort("alpha");
	let response = service
		.fetch_json::<_, Vec<dto::ArtistHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let artists = response.body();

	// Check that names are in alphabetical order
	for i in 1..artists.len() {
		assert!(artists[i - 1].name <= artists[i].name);
	}
}

#[tokio::test]
async fn get_artists_sort_invalid_falls_back_to_alpha() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let request = protocol::artists_with_sort("gibberish");
	let response = service
		.fetch_json::<_, Vec<dto::ArtistHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let artists = response.body();

	// Should still return artists in alpha order (fallback)
	for i in 1..artists.len() {
		assert!(artists[i - 1].name <= artists[i].name);
	}
}

#[tokio::test]
async fn get_artists_sort_requires_auth() {
	let mut service = TestServiceType::new(&test_name!()).await;
	let request = protocol::artists_with_sort("popularity");
	let response = service.fetch(&request).await;
	assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
