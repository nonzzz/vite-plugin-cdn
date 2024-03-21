use ::std::path::PathBuf;
use serde_json;
use std::fs;
use swc_core::{
    common::{chain, Mark},
    ecma::{
        parser::{EsConfig, Syntax},
        transforms::{base::resolver, testing::test_fixture},
        visit::as_folder,
    },
};

use swc_global_external_visitor::{opts::Options, TransformExternalVisitior};

#[testing::fixture("tests/fixtures/**/input.js")]
fn test(input: PathBuf) {
    let config = match fs::read_to_string(input.with_file_name("config.json")) {
        Ok(json) => serde_json::from_str(&json).unwrap(),
        _ => Options::default(),
    };

    let output = input.with_file_name("output.js");

    test_fixture(
        Syntax::Es(EsConfig::default()),
        &|_| {
            let unresolved_mark = Mark::new();
            chain!(
                resolver(unresolved_mark, Mark::new(), false),
                as_folder(TransformExternalVisitior::new(config.clone()))
            )
        },
        &input,
        &output,
        Default::default(),
    )
}
