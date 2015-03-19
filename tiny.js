#!/usr/bin/node

/*
tiny.js - tiny static page generator for blogs

be sure to `chmod +x tiny.js` before usage,
and add to environment path

usage:
  tiny.js init -- initializes empty blog in current directory
  tiny.js blog -- begin writing a new blog entry in favorite editor
  tiny.js publish -- generates pages and publishes blog
*/

var fs = require('fs'),
    prompt = require('prompt'),
    exec = require('child_process').exec;

if(process.argv.length != 3) {
  console.error("tiny.js takes a single argument");
  console.error("Try tiny init, tiny blog, or tiny publish");
  process.exit(0);
}

// generates a content object
// loads from includes folder
function Import(name) {
  return {
    type: "include",
    path: name
  }
}

// generates a content object
// embedded directly
function Embed(content) {
  return {
    type: "embed",
    content: content
  }
}

function init() {
  // initializes blog in working directory
  // blogs have the following file structure:

  /*
    /blog/
      /blog/tiny.json -- blog descriptor file
      /blog/includes/
        * - files referenced by descriptor
          - tiny makes no requirements on what MUST be in here
          - it is for the benefit of the authoring tool
  */

  prompt.start();
  prompt.get(['Blog Name', 'Author', 'Git Remote'], function(err, result) {
    fs.writeFileSync("tiny.json", JSON.stringify({
      blogName: result["Blog Name"],
      blogAuthor: result["Author"],
      gitRemote: result["Git Remote"],
      header: Import("header.html"),
      footer: Import("footer.html"),
      style: Import("styles.css"),
      posts: [],
      raws: []
    }));

    fs.mkdirSync("includes");
    fs.writeFileSync("header.html", fs.readFileSync("default/header.html"));
    fs.writeFileSync("footer.html", fs.readFileSync("default/footer.html"));
    fs.writeFileSync("styles.css", fs.readFileSync("default/styles.css"));

    // setup git if necessary
    if(result["Git Remote"].length) {
      exec(
        "git init . && git remote add origin "+result["Git Remote"],
        function(){} // does it matter at this point?
      );
    }
  })
}

function blog() {

}

function publish() {

}

// perform desired action
({ init: init, blog: blog, publish: publish })[process.argv[2]]();
