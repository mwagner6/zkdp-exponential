use curve25519_dalek::{constants, ristretto::RistrettoPoint, scalar::Scalar};
use crate::participants;
use crate::generic_commitments::Commitment;
use coinflip::flip;
use num_bigint::BigUint;
use rayon::prelude::*;
use rand_core::OsRng;
#[cfg(test)]
use crate::rand::Rng;

// Helper function to unzip after parallel iters
trait Unzip4<A, B, C, D> {
    fn unzip_n(self) -> (Vec<A>, Vec<B>, Vec<C>, Vec<D>);
}

impl<I, A, B, C, D> Unzip4<A, B, C, D> for I
where
    I: Iterator<Item = (A, B, C, D)>,
{
    fn unzip_n(self) -> (Vec<A>, Vec<B>, Vec<C>, Vec<D>) {
        let mut a = Vec::new();
        let mut b = Vec::new();
        let mut c = Vec::new();
        let mut d = Vec::new();
        for (x, y, z, w) in self {
            a.push(x);
            b.push(y);
            c.push(z);
            d.push(w);
        }
        (a, b, c, d)
    }
}

pub struct BinomialRunner {
    client: participants::Client,
    input_commitments: Vec<RistrettoPoint>,
    coms_sum: RistrettoPoint,
    x_sum: Scalar,
    r_sum: Scalar,
    server: participants::Server,
    verifier: participants::Board,
    private_bits: Vec<Scalar>,
    private_commits: Vec<RistrettoPoint>,
    public_bits: Vec<Scalar>,
    xor_bits: Vec<Scalar>,
    xor_commits: Vec<RistrettoPoint>,
    final_x: Scalar,
    final_z: Scalar,
    lhs: RistrettoPoint,
    rhs: RistrettoPoint,
    result_output: Scalar,
    var_p_in_count: i32,
    var_p_n: i32,
    var_p_bits: Vec<Vec<Scalar>>,
    var_p_coms: Vec<Vec<RistrettoPoint>>,
    var_p_randomness: Vec<Vec<Scalar>>,
    var_p_randomness_final: Vec<Scalar>,
    var_p: bool,
}

impl BinomialRunner {

    // <===== Step 1 =====>
    // Initialization function. Takes in number of bits, and raw x_i bits. Chooses h and j arbitrarily. 
    pub fn new(x: &[u8]) -> BinomialRunner {
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
        let input_coms: Vec<RistrettoPoint> = x_new.par_iter()
                                                        .zip(r.par_iter())
                                                        .map(|(&x_i, &r_i)| 
                                                                        client.com.commit(x_i, r_i)
                                                            ).collect();

        let x_sum: Scalar = x_new.iter().sum();
        let r_sum: Scalar = r.iter().sum();
        let coms_sum: RistrettoPoint = input_coms.iter().sum();

        let lhs = client.com.commit(x_sum, r_sum);
        let rhs = coms_sum;
        assert_eq!(lhs, rhs);

        let server = participants::Server::new(2, g, h);
        let verifier = participants::Board::new(g, h);

        BinomialRunner {
            client,
            input_commitments: input_coms,
            coms_sum,
            x_sum,
            r_sum,
            server,
            verifier,
            private_bits: Vec::new(),
            private_commits: Vec::new(),
            public_bits: Vec::new(),
            xor_bits: Vec::new(),
            xor_commits: Vec::new(),
            final_x: Scalar::zero(),
            final_z: Scalar::zero(),
            lhs: RistrettoPoint::default(),
            rhs: RistrettoPoint::default(),
            result_output: Scalar::zero(),
            var_p_in_count: 0,
            var_p_n: 0,
            var_p_bits: Vec::new(),
            var_p_coms: Vec::new(),
            var_p_randomness: Vec::new(),
            var_p_randomness_final: Vec::new(),
            var_p: false,
        }
    }

    // <===== Step 2 =====> 
    // Returns Pederson commitments for each x_i
    pub fn get_x_commits(&self) -> Vec<String> {
        self.input_commitments.iter().map(
            |c| BigUint::from_bytes_le(&c.compress().to_bytes()).to_str_radix(10)
        ).collect()
    }

    // <===== Step 3 =====>
    // No Rust side involvement

    // <===== Step 4 =====>
    // Take in random private bits from JS, with cheating, and save them
    pub fn input_randomness(&mut self, bits: &[u8]) {
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

        self.private_bits = private_bits_new;

        let results: Vec<(
            Scalar,          
            Scalar, 
            RistrettoPoint,
            RistrettoPoint
        )> = self.private_bits
            .par_iter()
            .map(|bit| {
                let transcript = self.server.com.create_proof_0(*bit);
                _ = self.verifier.verify(&transcript);
                let b = flip();
                if b {
                    let public_flip = Scalar::one();
                    let xor_flip = Scalar::one() - bit;
                    let com_one = self.server.com.commit(Scalar::one(), Scalar::one());
                    let bit_com = &com_one - &transcript.com;
                    (public_flip, xor_flip, bit_com, transcript.com)
                } else {
                    let public_flip = Scalar::zero();
                    let xor_flip = *bit;
                    (public_flip, xor_flip, transcript.com, transcript.com)
                }
            })
            .collect();
    
        let (public_flips, xor_flips, bit_coms, private_commits): (Vec<_>, Vec<_>, Vec<_>, Vec<_>) = results.into_iter().unzip_n();
        self.public_bits = public_flips;
        self.xor_bits = xor_flips;
        self.xor_commits = bit_coms;
        self.private_commits = private_commits;
    }

    // <===== Step 5 =====>
    // Return commitments for each of the privately random bits
    pub fn get_private_random_commits(&self) -> Vec<String> {
        self.private_commits.iter().map(
            |c| BigUint::from_bytes_le(&c.compress().to_bytes()).to_str_radix(10)
        ).collect()
    }

    // <===== Step 6 =====>
    // We can change this, but the site should just return True. There is no option for non-integer randomness
    // And even if there were, Rust forces values into 0 or 1 so it wouldn't matter


    // <===== Step 7 =====>
    // Morra flips. Already has taken place. Can return sampled randomness
    pub fn get_public_random(&self) -> Vec<u8> {
        self.public_bits.iter().map(
            |b| if *b == Scalar::one() {
                1
            } else {
                0
            }
        ).collect()
    }

    // <===== Alternate Step 7 =====>
    // Given ranges of values that are privately 0 or 1, returns a list of indices, and records the commitments of each. 
    // Used for variable p binomial mechanism
    pub fn rand_p_init(&mut self, n: i32) {
        self.var_p_n = n;
        self.var_p = true;
    }

    pub fn random_variable_p_input(&mut self, k: u32, m: i32, bits: &[u8]) -> bool {
        if bits.len() != m as usize {
            return false;
        }

        let bits: Vec<Scalar> = bits.iter().map(|b| {
            match *b {
                0 => {
                    Scalar::zero()
                },
                _ => {
                    Scalar::one()
                }
            }
        }).collect();

        let r: Vec<Scalar> = (0..bits.len()).map(|_| {
            let mut csprng = OsRng;
                Scalar::random(&mut csprng)
        }).collect();

        let bit_coms: Vec<RistrettoPoint> = bits.iter().zip(r.iter()).map(|(b, r)| self.server.com.commit(*b, *r)).collect();
        let lhs: RistrettoPoint = bit_coms.iter().sum();
        let rhs = self.server.com.commit(Scalar::try_from(k).unwrap(), r.iter().sum());
        if lhs != rhs {
            return false;
        } else {
            self.var_p_bits.push(bits);
            self.var_p_coms.push(bit_coms);
            self.var_p_randomness.push(r);
            self.var_p_in_count += 1;
            return true;
        }
        
    }

    pub fn random_variable_p_end(&mut self) -> bool {
        if self.var_p_n != self.var_p_in_count {
            false
        } else {
            for range in self.var_p_bits.iter().zip(self.var_p_coms.iter()).zip(self.var_p_randomness.iter()) {
                let ind = (rand::random::<f32>() * range.0.0.len() as f32).floor() as usize;
                self.xor_bits.push(range.0.0[ind]);
                self.xor_commits.push(range.0.1[ind]);
                self.var_p_randomness_final.push(range.1[ind])
            }
            true
        }
    }


    // <===== Step 8 =====>
    // XOR Private and public bits. This is done, so this call will return XORed bits and their commits
    pub fn get_xor_bits(&self) -> Vec<u8> {
        self.xor_bits.iter().map(
            |b| if *b == Scalar::one() {
                1
            } else {
                0
            } 
        ).collect()
    }

    pub fn get_xor_commits(&self) -> Vec<String> {
        self.xor_commits.iter().map(
            |c| BigUint::from_bytes_le(&c.compress().to_bytes()).to_str_radix(10)
        ).collect()
    }

    pub fn overwrite_xor_bits(&mut self, bits: &[u8]) {
        let overwrite_bits_new: Vec<Scalar> = bits.iter().map(
            |x| match *x {
                1 => {
                    Scalar::one()
                },
                _ => {
                    Scalar::zero()
                }
            }
        ).collect(); 
        self.xor_bits = overwrite_bits_new;
    }

    // <===== Step 9 =====>
    // Compute sum (output result). 
    pub fn compute_sum(&mut self) -> u64 {
        if self.var_p {
            let p_sum: Scalar = self.xor_bits.iter().sum();
            self.result_output = self.x_sum + p_sum;
            let s_sum: Scalar = self.var_p_randomness_final.iter().sum();
            self.final_x = self.x_sum + p_sum;
            self.final_z = self.r_sum + s_sum;

            BigUint::from_bytes_le(&self.result_output.to_bytes()).to_u64_digits()[0]
        } else {
            let v_sum: Scalar = self.public_bits.iter().sum();
            let s_sum: Scalar = self.xor_bits.iter().sum();
            let x = self.x_sum + v_sum;
            let z = self.r_sum + s_sum;
            self.result_output = self.x_sum + s_sum;
            self.final_x = x;
            self.final_z = z;

            BigUint::from_bytes_le(&self.result_output.to_bytes()).to_u64_digits()[0]
        }
    }

    // <===== Step 10 =====>
    // Returns Z
    pub fn get_z(&self) -> String {
        BigUint::from_bytes_le(&self.final_z.to_bytes()).to_str_radix(10)
    }

    // <===== Step 11 =====>
    // Commits final sum with total final randomness, and computes sum of previous commitments
    // Returns final lhs and rhs
    pub fn commit_pedersons(&mut self) {
        let lhs = self.client.com.commit(self.final_x, self.final_z);
        let v_coms_sum: RistrettoPoint = self.xor_commits.iter().sum();
        let rhs = self.coms_sum + v_coms_sum;
        self.lhs = lhs;
        self.rhs = rhs;
    }

    pub fn get_lhs(&self) -> String {
        BigUint::from_bytes_le(&self.lhs.compress().to_bytes()).to_str_radix(10)
    }

    pub fn get_rhs(&self) -> String {
        BigUint::from_bytes_le(&self.rhs.compress().to_bytes()).to_str_radix(10)
    }
}


// Tests/full working of BinomialRunner with variable options. Unused variables would be displayed on the frontend. 
#[test]
pub fn test_unbiased_p() {
    let mut rng = rand::thread_rng();
    let bits: Vec<u8> = (0..100000).map(|_| rng.gen_bool(0.5) as u8).collect();
    let init_sum: u32 = bits.iter().map(|&x| x as u32).sum();
    println!("Initial count: {}", init_sum); // Check initial count of positives

    let mut br: BinomialRunner = BinomialRunner::new(&bits); // Initialize a new BinomialRunner (inputs bits, calculates commitments)

    let _coms = br.get_x_commits(); // Get commitments out 

    let randbits: Vec<u8> = (0..100000).map(|_| rng.gen_bool(0.5) as u8).collect();
    br.input_randomness(&randbits); // Input private randomness into our BinomialRunner

    let _privrand_coms = br.get_private_random_commits(); // Get commitments of private randomness
    let _pubrand = br.get_public_random(); // Get publicly decided random bits 
    let xorbits = br.get_xor_bits(); // Get bits after XORing public and private bits

    let xorbitsum: u32 = xorbits.iter().map(|&x| x as u32).sum(); 
    println!("XORed bits sum: {}", xorbitsum); // Check amount of noise added

    let _xorcoms = br.get_xor_commits(); // Get commitments of XOR bits

    let output = br.compute_sum(); // Compute final output sum of our mechanism
    println!("Output: {}", output);
    let _z = br.get_z(); 

    br.commit_pedersons(); // Calculate final pedersons to do final checks. 

    let lhs = br.get_lhs(); // Get string representations of our 
    let rhs = br.get_rhs(); // final commitment sums in order to check
    assert_eq!(lhs, rhs) // Final check that our process was run faithfully
}


// This test is almost the same as the unbiased p without cheating. It has one change, which overwrites the bits after 
// the XOR operation (which would be how an adversary would attempt to cheat the distribution). The idea is to catch this
#[test]
pub fn test_unbiased_p_cheat() {
    let mut rng = rand::thread_rng();
    let bits: Vec<u8> = (0..100000).map(|_| rng.gen_bool(0.5) as u8).collect();
    let init_sum: u32 = bits.iter().map(|&x| x as u32).sum();
    println!("Initial count: {}", init_sum);

    let mut br: BinomialRunner = BinomialRunner::new(&bits);

    let _coms = br.get_x_commits();

    let randbits: Vec<u8> = (0..100000).map(|_| rng.gen_bool(0.5) as u8).collect();
    br.input_randomness(&randbits);

    let _privrand_coms = br.get_private_random_commits();
    let _pubrand = br.get_public_random();
    let xorbits = br.get_xor_bits();

    let xorbitsum: u32 = xorbits.iter().map(|&x| x as u32).sum(); 
    println!("XORed bits sum: {}", xorbitsum);

    br.overwrite_xor_bits(&vec![1; xorbits.len()]); // Overwrite our XORed bits with all 1's. This would cause the output to be higher than it should be
    let _xorcoms = br.get_xor_commits();

    let output = br.compute_sum();
    println!("Output: {}", output);
    let _z = br.get_z();

    br.commit_pedersons();
    let lhs = br.get_lhs();
    let rhs = br.get_rhs();
    assert_ne!(lhs, rhs) // When we do our final check, we ensure that our LHS and RHS were different - we ensure that we catch the 'cheat'
}

// This test shows a faithful implementation of a biased binomial mechanism
#[test]
pub fn test_biased_p() {
    let mut rng = rand::thread_rng();
    let bits: Vec<u8> = (0..10000).map(|_| rng.gen_bool(0.5) as u8).collect();
    let mut br: BinomialRunner = BinomialRunner::new(&bits); // Our initialization is the same - meant for maximum simplicity when changing systems

    let _coms = br.get_x_commits();

    br.rand_p_init(1000); // Tells our BinomialRunner that we will be using biased p with 100 bits
    for _ in 0..1000 { // For each biased flip, we need to run our process for a public coin. This is computationally expensive, but sadly difficult to avoid
        let mut randbits: Vec<u8> = vec![1; 17];
        randbits.extend(vec![0; 83]);
        assert!(br.random_variable_p_input(17, 100, &randbits)); // Function that computes commitments, and checks that the sum of our bits is equal to our proposed numerator
    }
    assert!(br.random_variable_p_end()); // Final check on our variable p randomness. Checks that we have computed the correct number of bits. 
    
    let xorbits = br.get_xor_bits(); // The remaining part is again the same as for the unbiased p. Some functions compute differently.
    println!("XOR bits: {:?}", xorbits);

    let _xorcoms = br.get_xor_commits();

    let out = br.compute_sum();
    println!("XOR sum: {}", out);
    let _z = br.get_z();
    br.commit_pedersons();
    let lhs = br.get_lhs();
    let rhs = br.get_rhs();
    assert_eq!(lhs, rhs); // Check that our noise was correctly added.
}

// This function tests that we catch cheating with the biased binomial mechanism. It is essentially the same as without cheating, with one extra call.
#[test]
pub fn test_biased_p_cheat() {
    let mut rng = rand::thread_rng(); // Same initialization as before
    let bits: Vec<u8> = (0..10000).map(|_| rng.gen_bool(0.5) as u8).collect();
    let mut br: BinomialRunner = BinomialRunner::new(&bits);

    let _coms = br.get_x_commits();

    br.rand_p_init(1000); // Same randomness input process as before. 
    for _ in 0..1000 {
        let mut randbits: Vec<u8> = vec![1; 17];
        randbits.extend(vec![0; 83]);
        assert!(br.random_variable_p_input(17, 100, &randbits));
    }
    assert!(br.random_variable_p_end());

    let xorbits = br.get_xor_bits();
    println!("XOR bits: {:?}", xorbits);

    let _xorcoms = br.get_xor_commits();

    br.overwrite_xor_bits(&vec![0; xorbits.len()]); // This is our cheat. Here, we overwrite all our final bits with 0's, artificially decreasing the count.

    let out = br.compute_sum();
    println!("XOR sum: {}", out);
    let _z = br.get_z();
    br.commit_pedersons();
    let lhs = br.get_lhs();
    let rhs = br.get_rhs();
    assert_ne!(lhs, rhs); // Check that our lhs and rhs are different, ensuring we catch the cheating.
}