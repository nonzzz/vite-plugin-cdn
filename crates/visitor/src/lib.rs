use opts::{Module, Options};
use std::collections::HashMap;
use std::vec::Vec;
use swc_core::{
    common::{util::take::Take, AstNode},
    ecma::{
        self,
        ast::{ImportDecl, ModuleDecl, ModuleItem, Stmt},
        visit::{VisitMut, VisitMutWith},
    },
};

pub mod opts;

pub struct TransformExternalVisitior {
    dependencices: HashMap<String, Module>,
    in_global_scope: bool,
}

// star with alias

impl TransformExternalVisitior {
    pub fn new(options: Options) -> Self {
        Self {
            dependencices: options.into(),
            in_global_scope: false,
        }
    }

    fn scan_import_stmt(&self, import_decl: &mut ImportDecl) {
        match self.dependencices.get(import_decl.src.value.as_str()) {
            Some(_) => {
                import_decl.take();
            }
            None => (),
        }
    }

    fn scan_export_stmt() {}
}

// https://swc.rs/docs/plugin/ecmascript/cheatsheet#make-your-handlers-stateless
// Only handle javaScript
impl VisitMut for TransformExternalVisitior {
    fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
        self.scan_import_stmt(n);
    }

    fn visit_mut_stmt(&mut self, stmt: &mut Stmt) {
        // println!("{:?}", stmt)
        stmt.visit_mut_children_with(self);
    }

    fn visit_mut_stmts(&mut self, stmts: &mut Vec<Stmt>) {
        println!("{:?}", stmts)
    }

    fn visit_mut_module_items(&mut self, stmts: &mut Vec<ModuleItem>) {
        stmts.visit_mut_children_with(self);
        stmts.retain(|s| match s {
            ModuleItem::ModuleDecl(ModuleDecl::Import(x)) => !x.src.is_empty(),
            _ => true,
        });
    }
}
