import { fail, debug } from './utils.ts';
import {
  Instruction, Term, Rew, Rule,
  Knd, All, Ref,
  subst
} from './term.ts';
import { pp_term, pp_context,  } from './pp.ts';
import { pp_dtrees } from './dtree.ts';
import { Ctxt, Ctx, extend, get_term } from './context.ts';
import { Environment } from './env.ts';
import { ReductionEngine } from './red.ts';
import { RuleChecker } from './rulechecker.ts';



export type Message = { status:'ok'|'info'|'warn', title:string, msg:string, ins?: Instruction[] };

export class Signature {
  start_time: Date;
  time: Date;
  env: Environment;
  red: ReductionEngine;
  rulechecker: RuleChecker;

  constructor(env = new Environment(), red = new ReductionEngine()) {
    this.start_time=new Date();
    this.time=this.start_time;
    this.env = env;
    this.red = red;
    this.rulechecker = new RuleChecker(env,red);
  }
  
  // Infers the type of a term
  infer(term: Term, ctx=Ctx()) : Term {
    // console.log("Infer",term.c,term,pp_term(term,ctx));
    switch (term.c) {
      case "Knd": fail("Infer","Cannot infer the type of Kind !");
      case "Typ": return Knd();
      case "All":
        const dom_sort = this.red.whnf( this.infer(term.dom, ctx) );
        const cod_sort = this.red.whnf( this.infer(term.cod, extend(ctx, [term.name, term.dom])) );
        if (dom_sort.c !== "Typ") {
          fail("Infer","Domain of forall is not a type: `" + pp_term(term, ctx) + "`.\n" + pp_context(ctx));
        }
        if (cod_sort.c !== "Typ" && cod_sort.c !== "Knd") {
          fail("Infer","Codomain of forall is neither a type nor a kind: `" + pp_term(term, ctx) + "`.\n" + pp_context(ctx));
        }
        return cod_sort;
      case "Lam":
        if (term.type === null) {
          fail("Infer","Can't infer non-annotated lambda `"+pp_term(term,ctx)+"`.\n" + pp_context(ctx));
        } else {
          const body_t = this.infer(term.body, extend(ctx, [term.name, term.type]));
          const term_t = All(term.name, term.type, body_t);
          this.infer(term_t, ctx);
          return term_t;
        }
      case "App":
        const func_t = this.red.whnf( this.infer(term.func, ctx));
        if (func_t.c !== "All") {
          fail("Infer","Non-function application on `" + pp_term(term, ctx) + "`.\n" + pp_context(ctx));
        }
        this.check(term.argm, func_t.dom, ctx);
        return subst(func_t.cod, term.argm);
      case "Ref": return this.env.do_get(term.name).type;
      case "Var":
        const ctxt_type = get_term(ctx, term.index);
        if(!ctxt_type) { fail("Infer","Cannot infer the type of free variable "+pp_term(term, ctx)); }
        return ctxt_type;
      case "MVar": fail("Infer","Cannot infer the type of a meta-variable instance: "+pp_term(term, ctx));
      default: fail("Infer","Unable to infer type of `" + pp_term(term, ctx) + "`.\n" + pp_context(ctx));
    }
  }
  
  // Checks if a term has given expected type
  check(term: Term, expected_type: Term, ctx : Ctxt = Ctx()) : void {
    // console.log("Check",term.c,term, pp_term(term,ctx));
    if (term.c === 'MVar') { fail("Check", "Cannot check the type of a meta-variable instance: "+pp_term(term, ctx)); }
    const type = this.red.whnf(expected_type);
    if (type.c === "All" && term.c === "Lam") {
      if (term.type.c === 'Jok') {
        term.type = type.dom;
      } else if (!this.red.are_convertible(term.type, type.dom)) {
        fail("Check", `Incompatible annotation [${pp_term(term, ctx)}].\n`+
          "- Expect = " + pp_term(type.dom, ctx)+"\n"+
          "- Actual = " + pp_term(term.type, ctx)+"\n"+
          pp_context(ctx));
      }
      this.infer(type.dom, ctx);
      this.check(term.body, type.cod, extend(ctx, [type.name, type.dom]));
    } else {
      const term_t = this.infer(term, ctx);
      if (!this.red.are_convertible(type, term_t)) {
        fail("Check", "Type mismatch on "+pp_term(term, ctx)+"\n"+
          "- Expect = " + pp_term(type  , ctx)+"\n"+
          "- Actual = " + pp_term(term_t, ctx)+"\n"+
          pp_context(ctx));
      }
    }
  }
  
  // Checks declared type and adds a new symbol to the environment
  declare_symbol(ins : Instruction) : void {
    const sort = this.red.whnf( this.infer(ins.type) );
    if (sort.c !== "Typ" && sort.c !== "Knd") {
      fail("Declaration","Declared type is not a sort.: `" + pp_term(ins.type) + "`.");
    }
    this.env.add_new_symbol(ins.name, ins.type, ins.c==="Thm");
  }

  // Process a single unscoped instruction
  *check_instruction(ins : Instruction, load : ((mod:string)=>Instruction[]) | null = null, namespace:string="", ins_stack : Instruction[] = []) : Generator<Message, void, void> {
    try {
      this.env.scope_instruction(ins, namespace);
      switch (ins.c) {
        case "Decl":
          ins.type = ins.type || this.infer(ins.def);
          this.declare_symbol(ins);
          if (ins.constant) {
            this.red.declare_constant(ins.name);
            yield { status:'ok', title:"Constant symbol declared", msg:`\`${ins.name}\` with type ${pp_term(ins.type)}` };
          } else if (ins.def) {
            this.rulechecker.declare_rule( Rew(ins.ln, Ref(ins.name),ins.def,ins.name+"_def") );
            if (ins.theorem) {
              yield { status:'ok', title:"Theorem proven", msg:`\`${ins.name}\` proves ${pp_term(ins.type)}` };
            } else {
              yield { status:'ok', title:"Symbol defined", msg:`\`${ins.name}\` as ${pp_term(ins.def)}`};
            }
          } else {
            if (ins.theorem) {
              yield { status:'ok', title:"Proof required", msg:`\`${ins.name}\` for theorem ${pp_term(ins.type)}`};
            } else {
              yield { status:'ok', title:"Symbol declared", msg:`\`${ins.name}\` with type ${pp_term(ins.type)}`};
            }
          }
          break;
        case "DeclConst":
          this.red.declare_constant(ins.name);
          yield { status:'ok', title:"Symbol declared constant", msg:`\`${ins.name}\``};
          break;
        case "DeclInj":
          this.red.declare_injective(ins.name);
          yield { status:'ok', title:"Symbol declared injective", msg:`\`${ins.name}\` (no check)`};
          break;
        case "Rew":
          this.rulechecker.declare_rule(ins as Rule);
          if (ins.lhs.c==='Ref' && this.env.get(ins.lhs.name).proven) {
            yield { status:'ok', title:"Theorem proven", msg:`\`${ins.lhs.name}\``};
          } else {
            yield { status:'ok', title:"Rewrite rule added", msg:`${pp_term(ins.lhs)} --> ${pp_term(ins.rhs)}`};
          }
          break;
        case "Eval":
          yield { status:'info', title:"Eval", msg:pp_term(this.red.nf(ins.term), ins.ctx)+"\n"+pp_context(ins.ctx) };
          break;
        case "Infer":
          yield { status:'info', title:"Infer", msg:pp_term(this.infer(ins.term, ins.ctx), ins.ctx)+"\n"+pp_context(ins.ctx) };
          break;
        case "CheckType":
          this.check(ins.term, ins.type, ins.ctx);
          yield { status:'ok', title:"CheckType", msg:
              pp_term(ins.term, ins.ctx)+" has indeed type "+pp_term(ins.type, ins.ctx)+"\n"+
              pp_context(ins.ctx)
              };
          break;
        case "CheckConv":
          if (this.red.are_convertible(ins.lhs, ins.rhs) == ins.cv) {
            yield { status:'ok', title:"CheckConv",
              msg:pp_term(ins.lhs,ins.ctx)+" is indeed "+(ins.cv ? "" : "not ")+"convertible with "+pp_term(ins.rhs,ins.ctx)
              };
          } else {
            yield { status:'warn', title:"CheckConv",
              msg:pp_term(ins.lhs,ins.ctx)+" is in fact "+(ins.cv ? "not " : "")+"convertible with "+pp_term(ins.rhs,ins.ctx)
              };
          }
          break;
        case "Print":
          yield { status:'info', title:"Show", msg:pp_term(ins.term) };
          break;
        case "DTree":
          yield { status:'info', title:"DTree", msg:"Decision tree for symbol `"+ins.name+"`:\n"+pp_dtrees(this.red.get(ins.name).decision_trees) };
          break;
        case "Time":
          const d = new Date();
          const dt = d.getTime() - this.time.getTime();
          this.time = d;
          yield { status:'info', title:"Time", msg:''+d.toLocaleString()+'  ('+dt+'ms since last clock)' };
          break;
        case "Req":
          if (!load) { fail('Require',"Current setup does not support `#REQUIRE`."); }
          for (const log of
            this.check_instructions( load(ins.module), load,
              ins.alias ? (namespace ? namespace+"." : "")+ins.alias : namespace,
              ins_stack = ins_stack.concat(ins) )
          ) {
            yield log;
          }
          yield { status:'ok', title:"Require", msg:`Module [${ins.module}] successfully loaded.` };
          break;
        case "DebugOn":
          debug.enable_log();
          break;
        case "DebugOff":
          debug.disable_log();
          break;
        default:
          fail("Instruction","Unexpected instruction constructor:"+ins.c);
      }
    //*
    } catch(e : any) {
      e.ln = ins.ln;
      throw e;
    }
    //*/
  }
  
  *check_instructions(instructions: Instruction[], load : ((mod:string)=>Instruction[]) | null=null, namespace="", ins_stack : Instruction[] = []) {
    if (!Array.isArray(instructions)) {
      fail("Instruction","Unexpected set of instructions. The checker is not used properly...");
    }
    for (const ins of instructions) {
      for (const log of this.check_instruction(ins, load, namespace, ins_stack)) {
        if (log !== undefined) {
          log.ins = ins_stack.concat(ins);
        }
        yield log;
      }
    };
    
    // Check that all required proofs were provided at some points
    this.env.all_proven(namespace);
  }
  
}
