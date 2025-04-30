use wasm_bindgen::prelude::*;
use curve25519_dalek::{constants, ristretto::RistrettoPoint, scalar::Scalar};
use crate::participants;
use crate::generic_commitments::Commitment;
use coinflip::flip;
use num_bigint::BigUint;

use rand_core::OsRng;

#[wasm_bindgen]
pub struct BinomialRunner {
    h: RistrettoPoint,
    g: RistrettoPoint,
    num_clients: i32,
    num_shares: usize,
    x: Vec<Scalar>,
    r: Vec<Scalar>,
    client: participants::Client,
    input_commitments: Vec<RistrettoPoint>,
    coms_sum: RistrettoPoint,
    x_sum: Scalar,
    r_sum: Scalar,
    server: participants::Server,
    verifier: participants::Board,
    private_bits: Vec<Scalar>,
    public_bits: Vec<Scalar>,
    xor_bits: Vec<Scalar>,
    xor_commits: Vec<RistrettoPoint>,
    final_x: Scalar,
    final_z: Scalar,
    lhs: RistrettoPoint,
    rhs: RistrettoPoint,
}

#[wasm_bindgen]
impl BinomialRunner {

    // <===== Step 1 =====>
    // Initialization function. Takes in number of bits, and raw x_i bits. Chooses h and j arbitrarily. 
    #[wasm_bindgen(constructor)]
    pub fn new(n: i32, x: &[u8]) -> BinomialRunner {
        let h: RistrettoPoint = RistrettoPoint::from_uniform_bytes(b"this is another secret that should never be disclosed to anyone ");
        let g: RistrettoPoint = constants::RISTRETTO_BASEPOINT_POINT;
        let x_new: Vec<Scalar> = x.iter().map(
            |x| match *x{
                1 => {
                    Scalar::one()
                },
                _ => {
                    Scalar::zero()
                }
            }
        ).collect();
        let r: Vec<Scalar> = vec![0; x_new.len()].iter().map(
            |_| {
                let mut csprng = OsRng;
                Scalar::random(&mut csprng)
            }
        ).collect();
        let client = participants::Client::new(2, g, h);
        let mut input_coms: Vec<RistrettoPoint> = Vec::new();
        for i in 0..x_new.len() {
            let com = client.com.commit(x_new[i], r[i]);
            input_coms.push(com);
        }

        let x_sum: Scalar = x_new.iter().sum();
        let r_sum: Scalar = r.iter().sum();
        let coms_sum: RistrettoPoint = input_coms.iter().sum();

        let lhs = client.com.commit(x_sum, r_sum);
        let rhs = coms_sum;
        assert_eq!(lhs, rhs);

        let server = participants::Server::new(2, g, h);
        let verifier = participants::Board::new(g, h);

        BinomialRunner {
            h,
            g,
            num_clients: n,
            num_shares: 2,
            x: x_new,
            r,
            client,
            input_commitments: input_coms,
            coms_sum: coms_sum,
            x_sum,
            r_sum,
            server,
            verifier,
            private_bits: Vec::new(),
            public_bits: Vec::new(),
            xor_bits: Vec::new(),
            xor_commits: Vec::new(),
            final_x: Scalar::zero(),
            final_z: Scalar::zero(),
            lhs: RistrettoPoint::default(),
            rhs: RistrettoPoint::default()
        }
    }

    // <===== Step 2 =====> 
    // Returns Pederson commitments for each x_i
    pub fn get_x_commits(self) -> Vec<JsValue> {
        self.input_commitments.iter().map(
            |c| JsValue::from_str(&BigUint::from_bytes_be(&c.compress().to_bytes()).to_str_radix(10))
        ).collect()
    }

    // <===== Step 3 =====>
    // No Rust side involvement

    // <===== Step 4 =====>
    // Take in random private bits from JS, with cheating, and save them
    pub fn input_randomness(mut self, bits: &[u8]) {
        let private_bits_new: Vec<Scalar> = bits.iter().map(
            |x| match *x {
                1 => {
                    Scalar::one()
                },
                _ => {
                    Scalar::zero()
                }
            }
        ).collect();
        let mut public_flips: Vec<Scalar> = Vec::new();
        let mut xor_flips: Vec<Scalar> = Vec::new();
        let mut bit_coms: Vec<RistrettoPoint> = Vec::new();
        self.private_bits = private_bits_new;
        for bit in self.private_bits.iter() {
            let transcript = self.server.com.create_proof_0(*bit);
            _ = self.verifier.verify(&transcript);
            let b = flip();
            if b {
                public_flips.push(Scalar::one());
                xor_flips.push(Scalar::one() - bit);
                let com_one = self.server.com.commit(Scalar::one(), Scalar::one());
                bit_coms.push(&com_one - &transcript.com);
            } else {
                public_flips.push(Scalar::zero());
                xor_flips.push(*bit);
                bit_coms.push(transcript.com)
            }
        }
        self.public_bits = public_flips;
        self.xor_bits = xor_flips;
        self.xor_commits = bit_coms;
    }

    // <===== Step 6 =====>
    // We can change this, but the site should just return True. There is no option for non-integer randomness
    // And even if there were, Rust forces values into 0 or 1 so it wouldn't matter


    // <===== Step 7 =====>
    // Morra flips. Already has taken place. Can return sampled randomness
    pub fn get_public_random(self) -> Vec<u8> {
        self.public_bits.iter().map(
            |b| if *b == Scalar::one() {
                1
            } else {
                0
            }
        ).collect()
    }

    // <===== Step 8 =====>
    // XOR Private and public bits. This is done, so this call will return XORed bits and their commits
    pub fn get_xor_bits(self) -> Vec<u8> {
        self.xor_bits.iter().map(
            |b| if *b == Scalar::one() {
                1
            } else {
                0
            } 
        ).collect()
    }

    pub fn get_xor_commits(self) -> Vec<JsValue> {
        self.xor_commits.iter().map(
            |c| JsValue::from_str(&BigUint::from_bytes_be(&c.compress().to_bytes()).to_str_radix(10))
        ).collect()
    }

    // <===== Step 9 =====>
    // Compute sum (output result). 
    pub fn compute_sum(mut self) -> u64 {
        let v_sum: Scalar = self.private_bits.iter().sum();
        let s_sum: Scalar = self.xor_bits.iter().sum();
        let x = self.x_sum + v_sum;
        let z = self.r_sum + s_sum;
        self.final_x = x;
        self.final_z = z;

        BigUint::from_bytes_be(&self.final_x.to_bytes()).to_u64_digits()[0]
    }

    // <===== Step 10 =====>
    // Returns Z
    pub fn get_z(self) -> JsValue {
        JsValue::from_str(&BigUint::from_bytes_be(&self.final_z.to_bytes()).to_str_radix(10))
    }

    // <===== Step 11 =====>
    // Commits final sum with total final randomness, and computes sum of previous commitments
    // Returns final lhs and rhs
    pub fn commit_pedersons(mut self) {
        let lhs = self.client.com.commit(self.final_x, self.final_z);
        let v_coms_sum: RistrettoPoint = self.xor_commits.iter().sum();
        let rhs = self.coms_sum + v_coms_sum;
        self.lhs = lhs;
        self.rhs = rhs;
    }

    pub fn get_lhs(self) -> JsValue {
        JsValue::from_str(&BigUint::from_bytes_be(&self.lhs.compress().to_bytes()).to_str_radix(10))
    }

    pub fn get_rhs(self) -> JsValue {
        JsValue::from_str(&BigUint::from_bytes_be(&self.rhs.compress().to_bytes()).to_str_radix(10))
    }
}