use std::collections::{HashMap, HashSet};

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Module {
    pub name: String,
    pub global: String,
    pub aliases: Vec<String>,
    pub bindings: HashSet<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Options {
    pub modules: Vec<Module>,
}

impl From<Options> for HashMap<String, Module> {
    fn from(options: Options) -> Self {
        options
            .modules
            .into_iter()
            .map(|module| (module.name.clone(), module))
            .collect()
    }
}

impl Default for Options {
    fn default() -> Self {
        Self {
            modules: Default::default(),
        }
    }
}
