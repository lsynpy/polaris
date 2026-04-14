use http::StatusCode;

use crate::{
	server::{
		dto,
		test::{
			add_trailing_slash,
			protocol::{self, V8},
			TestService, TestServiceType,
		},
	},
	test_name,
};

#[tokio::test]
async fn random_requires_auth() {
	let mut service = TestServiceType::new(&test_name!()).await;
	let request = protocol::random::<V8>();
	let response = service.fetch(&request).await;
	assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn random_golden_path() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let request = protocol::random::<V8>();
	let response = service
		.fetch_json::<_, Vec<dto::AlbumHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let entries = response.body();
	assert_eq!(entries.len(), 3);
}

#[tokio::test]
async fn random_with_trailing_slash() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let mut request = protocol::random::<V8>();
	add_trailing_slash(&mut request);
	let response = service
		.fetch_json::<_, Vec<dto::AlbumHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let entries = response.body();
	assert_eq!(entries.len(), 3);
}

#[tokio::test]
async fn recent_requires_auth() {
	let mut service = TestServiceType::new(&test_name!()).await;
	let request = protocol::recent::<V8>();
	let response = service.fetch(&request).await;
	assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn recent_golden_path() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let request = protocol::recent::<V8>();
	let response = service
		.fetch_json::<_, Vec<dto::AlbumHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let entries = response.body();
	assert_eq!(entries.len(), 3);
}

#[tokio::test]
async fn recent_with_trailing_slash() {
	let mut service = TestServiceType::new(&test_name!()).await;
	service.complete_initial_setup().await;
	service.login_admin().await;
	service.index().await;
	service.login().await;

	let mut request = protocol::recent::<V8>();
	add_trailing_slash(&mut request);
	let response = service
		.fetch_json::<_, Vec<dto::AlbumHeader>>(&request)
		.await;
	assert_eq!(response.status(), StatusCode::OK);
	let entries = response.body();
	assert_eq!(entries.len(), 3);
}
