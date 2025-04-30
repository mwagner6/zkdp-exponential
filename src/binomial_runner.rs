use wasm_bindgen::prelude::*;
use curve25519_dalek::{constants, ristretto::RistrettoPoint, scalar::Scalar};
use crate::participants;
use crate::generic_commitments::Commitment;
use crate::sigma_ff::ProofScalar;
use coinflip::flip;

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
    x_sum: Scalar,
    r_sum: Scalar,
    server: participants::Server,
    verifier: participants::Board,
    private_bits: Vec<Scalar>,
    public_bits: Vec<Scalar>,
    xor_bits: Vec<Scalar>
}

#[wasm_bindgen]
impl BinomialRunner {
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
            |x| {
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
            x_sum,
            r_sum,
            server,
            verifier,
            private_bits: Vec::new(),
            public_bits: Vec::new(),
            xor_bits: Vec::new(),
        }
    }

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
        
    }
}