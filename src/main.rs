use actix_web::{web, App, HttpResponse, HttpServer, Responder, error::Error as ActixWebError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, Arc};
use dp_client::binomial_runner::BinomialRunner;
use uuid::Uuid;

type RunnerMap = Arc<Mutex<HashMap<String, BinomialRunner>>>;

// Define input and output structures for API calls
#[derive(Deserialize, Debug)]
pub struct NewRunnerRequest {
    pub n: i32,
    pub x: Vec<u8>,
}

#[derive(Serialize)]
pub struct GetCommitsResponse {
    pub commits: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct InputRandomnessRequest {
    pub bits: Vec<u8>,
    pub session_id: String, // Expect session_id in the request
}

#[derive(Deserialize, Debug)]
pub struct OverwriteXorBitRequest {
    pub bits: Vec<u8>,
    pub session_id: String,
}

#[derive(Serialize)]
pub struct GetPrivateCommitsResponse {
    pub private_commits: Vec<String>,
}

#[derive(Serialize)]
pub struct GetRandomResponse {
    pub random_bits: Vec<u8>,
}

#[derive(Serialize)]
pub struct GetXorBitsResponse {
    pub xor_bits: Vec<u8>,
}

#[derive(Serialize)]
pub struct GetXorCommitsResponse {
    pub xor_commits: Vec<String>,
}

#[derive(Serialize)]
pub struct ComputeSumResponse {
    pub final_sum: u64,
}

#[derive(Serialize)]
pub struct GetZResponse {
    pub z: String,
}

#[derive(Serialize)]
pub struct GetLhsRhsResponse {
    pub lhs: String,
    pub rhs: String,
}

// API Handlers
async fn new_runner(
    req: web::Json<NewRunnerRequest>,
    runners: web::Data<RunnerMap>,
) -> impl Responder {
    println!("New runner called");
    let new_runner_instance = BinomialRunner::new(req.n, &req.x);
    let session_id = Uuid::new_v4().to_string(); // Generate new ID
    let mut runners_map = runners.lock().unwrap();
    runners_map.insert(session_id.clone(), new_runner_instance);
    HttpResponse::Ok().body(session_id) // Send session ID back as plain text, or .json(json!({session_id}))
}

async fn get_x_commits(
    req: web::Json<SessionIdRequest>, // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let commits = runner.get_x_commits().into_iter().map(|js_val| js_val).collect();
        Ok(HttpResponse::Ok().json(GetCommitsResponse { commits }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn input_randomness(
    req: web::Json<InputRandomnessRequest>, // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let mut runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get_mut(&req.session_id) {
        runner.input_randomness(&req.bits);
        Ok(HttpResponse::Ok().json("Randomness input"))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn get_private_random_commits(
    req: web::Json<SessionIdRequest>,
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let private_commits = runner.get_private_random_commits().into_iter().map(|js_val| js_val).collect();
        Ok(HttpResponse::Ok().json(GetPrivateCommitsResponse { private_commits }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    } 
}

async fn get_public_random(
    req: web::Json<SessionIdRequest>, // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let random_bits = runner.get_public_random();
        Ok(HttpResponse::Ok().json(GetRandomResponse { random_bits }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn get_xor_bits(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let xor_bits = runner.get_xor_bits();
        Ok(HttpResponse::Ok().json(GetXorBitsResponse { xor_bits }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn overwrite_xor_bits(
    req: web::Json<OverwriteXorBitRequest>,
    runners: web::Data<RunnerMap>
) -> Result<impl Responder, ActixWebError> {
    let mut runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get_mut(&req.session_id) {
        runner.overwrite_xor_bits(&req.bits);
        Ok(HttpResponse::Ok().json("Bits overwritten"))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn get_xor_commits(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let xor_commits = runner.get_xor_commits().into_iter().map(|js_val| js_val).collect();
        Ok(HttpResponse::Ok().json(GetXorCommitsResponse { xor_commits }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn compute_sum(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let mut runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get_mut(&req.session_id) {
        let final_sum = runner.compute_sum();
        Ok(HttpResponse::Ok().json(ComputeSumResponse { final_sum }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn get_z(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let z_str = runner.get_z();
        Ok(HttpResponse::Ok().json(GetZResponse { z: z_str }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn commit_pedersons(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let mut runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get_mut(&req.session_id) {
        runner.commit_pedersons();
        Ok(HttpResponse::Ok().json("Pederson commitments computed"))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn get_lhs(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let lhs_str = runner.get_lhs();
        Ok(HttpResponse::Ok().json(GetLhsRhsResponse { lhs: lhs_str, rhs: "".to_string() })) // Placeholder for rhs
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

async fn get_rhs(
    req: web::Json<SessionIdRequest>,  // Expect session_id in body
    runners: web::Data<RunnerMap>,
) -> Result<impl Responder, ActixWebError> {
    let runners_map = runners.lock().unwrap();
    if let Some(runner) = runners_map.get(&req.session_id) {
        let rhs_str = runner.get_rhs();
        let lhs_str = runner.get_lhs(); // Assuming you might want both
        Ok(HttpResponse::Ok().json(GetLhsRhsResponse { lhs: lhs_str, rhs: rhs_str }))
    } else {
        Err(actix_web::error::ErrorNotFound("Runner not found for this session"))
    }
}

#[derive(Deserialize, Debug)]
struct SessionIdRequest {
    session_id: String,
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let runners_map: RunnerMap = Arc::new(Mutex::new(HashMap::new()));
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(runners_map.clone()))
            .route("/new", web::post().to(new_runner))
            .route("/commits", web::post().to(get_x_commits))
            .route("/randomness", web::post().to(input_randomness))
            .route("/priv_random_commits", web::post().to(get_private_random_commits))
            .route("/public_random", web::post().to(get_public_random))
            .route("/xor_bits", web::post().to(get_xor_bits))
            .route("/overwrite_xor_bits", web::post().to(overwrite_xor_bits)) 
            .route("/xor_commits", web::post().to(get_xor_commits))
            .route("/compute_sum", web::post().to(compute_sum))  
            .route("/z", web::post().to(get_z))       
            .route("/commit_pedersons", web::post().to(commit_pedersons))
            .route("/lhs", web::post().to(get_lhs))     
            .route("/rhs", web::post().to(get_rhs))     
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await?;

    println!("Server initialized!");
    Ok(())
}
