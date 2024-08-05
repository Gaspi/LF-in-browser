<script setup lang="ts">
import { Parser, Grammar } from 'nearley';
import grammar from './lib/grammar.ts';
import { Signature, Message } from './lib/sig.ts';

import * as moo from 'moo';

/*
import { EditorView, keymap } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
//*/
import { CodeJar } from 'codejar'

import { ref, onMounted } from 'vue'


const logs = ref(null);
const check_button = ref(null);
const editor_wrapper = ref(null);
const file_input = ref(null)
const editor_content = ref(null);
const url_input = ref(null);
function load_url_input() {
  load_url(url_input.value.value)
}

function withLineNumbers(highlight, options = {}) {
    const opts = Object.assign({ class: "codejar-linenumbers", wrapClass: "codejar-wrap", width: "35px", backgroundColor: "rgba(128, 128, 128, 0.15)", color: "black" }, options);
    let lineNumbers;
    return function (editor) {
        highlight(editor);
        if (!lineNumbers) {
            lineNumbers = init(editor, opts);
            editor.addEventListener("scroll", () => lineNumbers.style.top = `-${editor.scrollTop}px`);
        }
        const code = editor.textContent || "";
        const linesCount = code.replace(/\n+$/, "\n").split("\n").length + 1;
        lineNumbers.innerHTML="";
        for (let i = 1; i < linesCount; i++) {
            const st = document.createElement('a');
            st.id=`l${i}`;
            st.text=`${i}`;
            lineNumbers.appendChild( st );
            lineNumbers.appendChild( document.createElement('br') );
        }
    };
}
function init(editor, opts) {
    const css = getComputedStyle(editor);
    const wrap = document.createElement("div");
    wrap.className = opts.wrapClass;
    wrap.style.position = "relative";
    const gutter = document.createElement("div");
    gutter.className = opts.class;
    wrap.appendChild(gutter);
    // Add own styles
    gutter.style.position = "absolute";
    gutter.style.top = "0px";
    gutter.style.left = "0px";
    gutter.style.bottom = "0px";
    gutter.style.width = opts.width;
    gutter.style.overflow = "hidden";
    gutter.style.backgroundColor = opts.backgroundColor;
    gutter.style.color = opts.color || css.color;
    //gutter.style.setProperty("mix-blend-mode", "difference");
    // Copy editor styles
    gutter.style.fontFamily = css.fontFamily;
    gutter.style.fontSize = css.fontSize;
    gutter.style.fontWeight = 'bold'; 
    gutter.style.lineHeight = css.lineHeight;
    gutter.style.paddingTop = css.paddingTop;
    gutter.style.paddingLeft = css.paddingLeft;
    gutter.style.borderTopLeftRadius = css.borderTopLeftRadius;
    gutter.style.borderBottomLeftRadius = css.borderBottomLeftRadius;
    // Add line numbers
    const lineNumbers = document.createElement("div");
    lineNumbers.style.position = "relative";
    lineNumbers.style.top = "0px";
    gutter.appendChild(lineNumbers);
    // Tweak editor styles
    editor.style.paddingLeft = `calc(${opts.width} + ${gutter.style.paddingLeft})`;
    editor.style.whiteSpace = "pre";
    // Swap editor with a wrap
    editor.parentNode.insertBefore(wrap, editor);
    wrap.appendChild(editor);
    return lineNumbers;
}


// Standard libraries
const default_load = 'examples/intro.dk';
const quick_loads = [
  'intro.dk',
  'intro_advanced.dk',
  { folder:'theories', index:true, content: [
    'pure_lambda_calculus.dk',
    'FOL.dk',
    'FO_cons.dk',
    'FO_rew.dk',
    'sttfa.dk',
    'cc.dk',
    { folder:'theorems', content: [
      'FO_thm.dk',
      'FO_nat.dk',
      ] },
  ] },
  { folder:'computations', content: [
      'church.dk',
      'nat_compute.dk',
    ] },
  { folder:'tests', index:true, content: [
    'basics.dk',
    'arities.dk',
    'ignored_cstr.dk',
    'readable_nat.dk',
    { folder:'SR', content: [
      'SR_OK_1.dk',
      'SR_OK_2.dk',
      'SR_OK_3.dk',
      'SR_OK_4.dk',
      'SR_sat_2.dk',
      'SR_sat_bv1.dk',
      'SR_sat_bv2.dk',
      'SR_sat_eq1.dk',
      'SR_sat_eq2.dk',
      'SR_cool_ex.dk',
      ] },
    ] },
  { folder:'sudoku', content: [
    'sudoku.dk',
    'solve_empty.dk',
    'solve_ultra_easy.dk',
    'solve_super_easy.dk',
    'solve_easy.dk',
    'solve_medium.dk',
    'solve_hardest.dk',
  ] },
  { folder:'SR', index:true, content: [
    'SR_1.dk',
    'SR_2.dk',
    'SR_3.dk',
    'SR_4.dk',
    'SR_5.dk',
  ] },
  "all.dk",
];

// Call fn after DOM is finished updating
function call_after_DOM_updated(fn) {
  const aux = function () {window.requestAnimationFrame(fn)}
  window.requestAnimationFrame(aux);
}

// Functions to populate the dropdown menu
function add_quick_load(e, element, prefix) {
  const li = document.createElement('li');
  const a = li.appendChild(document.createElement('a'));
  a.classList.add("dropdown-item");
  a.href="#";
  if (e.folder) {
    a.innerText = e.folder;
    const ul = li.appendChild(document.createElement('ul'));
    ul.classList.add("dropdown-menu", "dropdown-submenu");
    const folder_prefix = `${prefix}/${e.folder}`;
    if (e.index) {
      a.onclick = ()=>load_url(`${folder_prefix}/index.dk`);
    }
    add_quick_loads(e.content, ul, folder_prefix);
  } else {
    a.innerText = e;
    a.onclick = ()=>load_url(`${prefix}/${e}`);
  }
  element.prepend(li);
}
function add_quick_loads(modules, element, prefix) {
  modules.reverse().forEach((m)=>add_quick_load(m,element,prefix));
}


// Global variables for easy access
var code, instructions, sig;
var highlighter, jar;


function get(id) { return document.getElementById(id); }

function clear(e) {
  const children = e.children;
  for (let i = children.length-1; i > 0; i--) {
    e.removeChild(e.children[i]);
  }
}

// Logs handling
function clear_logs() {
  logs.value.innerHTML = "";
  clear(editor_wrapper.value);
}

function updateEditor(code) {
  jar.updateCode(code);
  clear_logs();
  if (get('check_after_load').checked) { check_editor(); }
}

function set_button_mode(mode) {
  
  check_button.value.classList.remove('btn-primary','btn-warning','btn-success','btn-danger');
  const button_style = {
    'check'   : { classname:'btn-primary', message:'Check'       },
    'checking': { classname:'btn-warning', message:'Checking...' },
    'checked' : { classname:'btn-success', message:'Checked!'    },
    'error'   : { classname:'btn-danger' , message:'Error!'      },
  }[mode];
  check_button.value.classList.add(button_style.classname);
  check_button.value.innerText = button_style.message;
}

function log_all_messages(proc, callback) {
  try {
    const message = proc.next();
    if (message.done) {
      return callback();
    } else {
      log_object(message.value);
      const fn = function() { log_all_messages(proc, callback) };
      //const aux = function () {window.requestAnimationFrame(fn)}
      window.requestAnimationFrame(fn);
    }
  } catch(e) {
    log('err', e.ln,e.title || 'ERROR', (e.msg || e)+"");
    set_button_mode('error');
    throw(e);
  }
}

function check_editor() {
  set_button_mode('checking');
  
  // Wait for DOM to update button to "Checking"
  call_after_DOM_updated( function() { // Main processing loop
    // Parsing of input text code
    const instructions = parse(editor_content.value.textContent);
    log('ok',null,"Parsing","done.");
    
    // Reseting the signature
    sig = new Signature();
    
    // Checking each instructions with the signature
    log_all_messages(sig.check_instructions(instructions,load_module), function() {
      const chrono = (new Date()).getTime() - sig.start_time.getTime();
      log('ok',null,"File Checking","All done ("+chrono+"ms) !");
      set_button_mode('checked');
    });
  });
}

// Source load from URL
function load_url(url) {
  if (!url) { return updateEditor(''); }
  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      // When the file is loaded, update editor with content (and check)
      updateEditor(xhttp.responseText);
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}

// Example loading
function load_example(e) {
  let filename = e.innerText;
  e = e.parentNode.parentNode;
  while (e.classList.contains('dropdown-submenu')) {
    filename = e.parentNode.childNodes[0].innerText+"/"+filename;
    e = e.parentNode.parentNode;
  }
  load_url("examples/"+filename);
}

// File loading
function load_file(file) {
  if (!file) { return; }
  const reader = new FileReader();
  reader.onload = (e)=>updateEditor(e.target.result);
  reader.readAsText(file);
}

// Custom text downloading as file
function download_text(text) {
  const file = new File([text], "dedukti.dk")
  // Create a link and set the URL using `createObjectURL`
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = URL.createObjectURL(file);
  link.download = file.name;

  // It needs to be added to the DOM so it can be clicked
  document.body.appendChild(link);
  link.click();

  // To make this work on Firefox : wait a little while before removing it.
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.parentNode.removeChild(link);
  }, 0);
}

// Editor content downloading
function download_editor_content() { download_text(editor_content.value.textContent); }

// Display a new block in the loading area
function log(status,ln,title,msg) {
  const div = document.createElement('div');
  div.style['white-space']= 'pre-wrap';
  div.innerHTML = (ln?ln+": ":"")+'<strong>['+title+']</strong> '+msg;
  div.classList.add('p-1', 'm-2', 'alert');
  const tag = {
    ok  :'success',
    info:'info',
    warn:'warning',
    err :'danger',
  }[status];
  div.classList.add('alert-'+tag);
  logs.value.insertAdjacentElement('afterbegin', div);
  if (ln>0) {
    const hovering = div.cloneNode();
    editor_wrapper.value.appendChild(hovering);
    hovering.style.zIndex=100;
    hovering.style.position = "absolute";
    hovering.style.display = "none";
    hovering.innerHTML = '<strong>['+title+']</strong> '+msg;
    const l = get('l'+ln);
    l.classList.add('text-'+tag);
    l.href="#"
    l.onmouseover = function() {
      hovering.style.width = parseInt(window.getComputedStyle(editor_content.value).getPropertyValue('width'))*0.8+"px";
      const bounds = l.getBoundingClientRect();
      hovering.style.display = 'block';
      hovering.style.left = 58+"px";
      hovering.style.top  = (bounds.top+11)+"px";
    };
    l.onmouseout = function() { hovering.style.display = 'none'; };
    l.onclick = function() { div.scrollIntoView(); };
  }
}

function log_object(o) {
  let msg = o.msg;
  while (o.ins.length > 1) {
    msg = "While loading module `"+o.ins.pop().module+"`, "+msg;
  }
  return log(o.status, o.ln || o.ins[0].ln, o.title, o.msg);
}

// Create a Parser object from our grammar.
const parser = new Parser(Grammar.fromCompiled(grammar));
const initial_state = parser.save();

// Convert a string to a series of instructions
function parse(code) {
  parser.restore(initial_state);
  parser.feed(code);
  return parser.results[0];
}

function load_module(module_name) {
  const url = module_name.startsWith("http") ? module_name : "examples/"+module_name+".dk";
  let res;
  let xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
       // Typical action to be performed when the document is ready:
       res = xhttp.responseText;
    }
  };
  // Synchronous request
  xhttp.open("GET", url, false);
  xhttp.send();
  if (!res) { fail("Load",`Failed to load URL: ${url}`); }
  return parse(res);
}

const dragenter = (e) => {
  e.stopPropagation();
  e.preventDefault();
}
const dragover = (e) => {
  e.stopPropagation();
  e.preventDefault();
}
const drop = (e) => {
  e.stopPropagation();
  e.preventDefault();
  load_file(e.dataTransfer.files[0]);
}

onMounted(function() {

  /*
  const myView = new EditorView({
    doc: "hello",
    extensions: [keymap.of(defaultKeymap)],
    parent: document.body
  });
  //*/
  
  check_button.value.onclick=()=>{clear_logs();check_editor()}
  file_input.onchange = (e)=>load_file(e.target.files[0]);

  editor_content.value.addEventListener("dragenter", dragenter, false);
  editor_content.value.addEventListener("dragover", dragover, false);
  editor_content.value.addEventListener("drop", drop, false);
  highlighter = moo.compile(
    {
      STRING: grammar.Lexer.groups.map(function (g) {
          const ng = Object.assign({}, g); // Deep copy
          const pre = `<span class="KW ${g.defaultType}">`;
          ng.value = txt => pre+txt+'</span>';
          return ng;
        }),
      myError: moo.error
    });
  const highlight = function (ed) {
    set_button_mode('check');
    highlighter.reset(ed.textContent);
    ed.innerHTML = Array.from(highlighter).map(x=>x.value).join('');
  };
  jar = CodeJar(editor_content.value, withLineNumbers(highlight, { color:'black' }), {tab: ' '.repeat(4)});
  add_quick_loads(quick_loads, get('dropdown-main-menu'),'examples');
  load_url(default_load);
})

</script>

<template>
  <div class="container-fluid main-wrapper">
    <div class="row justify-content-left">
      <div class="col justify-content-center vh-100 d-flex flex-column" style="max-width:700px;">
        <div class="mx-2 row">
          <div class="col-md-auto mx-4">
            <h1 class="m-0 p-0 text-center align-text-bottom" style="max-width:400px; font-size:60px">D
            <img src="./assets/duck.png" style="margin-bottom:10px; height:65px"></img>
            <img src="./assets/tea.jpg" style="margin-bottom:30px; height:100px"></img>
            </h1>
          </div>
          <div class="col-md" style="display:inline-block;">
            <button type="button" class="btn btn-primary btn-lg my-2 mt-0 w-100" ref="check_button">
              Check !
            </button>
            <div class="my-2 dropdown">
              <button type="button" class="btn btn-secondary dropdown-toggle btn-lg w-100" id="dropdown_examples" data-bs-toggle="dropdown" aria-expanded="false">
                Load
              </button>
              <ul class="dropdown-menu" aria-labelledby="dropdown_examples" id="dropdown-main-menu">
                <li><hr class="dropdown-divider"></li>
                <li><input class="ml-2" type="file" ref="file_input"></li>
                <li>
                  <input class="my-2 ml-2" type="text" ref="url_input">
                  <button class="btn btn-secondary btn-sm mb-1" @click="load_url_input">Load URL</button>
                </li>
                <li><a class="dropdown-item" href="#" @click="download_editor_content">Download editor content</a></li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <div class="mx-2 form-check">
                    <input class="form-check-input" type="checkbox" value="" id="check_after_load" checked/>
                    <label class="form-check-label" for="check_after_load">Check after load</label>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <h2 class="text-center">Ouput</h2>
        <div class="flex-fill overflow-auto" ref="logs"></div>
      </div>
      <div class="col vh-100 d-flex flex-column" style="background: #f2f2f2;">
        <div ref="editor_wrapper" class="mt-2 flex-fill overflow-auto">
          <div ref="editor_content" class="editor" style="font-family:monospace"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
