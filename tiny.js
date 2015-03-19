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
    exec = require('child_process').exec,
    marked = require("marked");

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

// reverses the above two functions
function Resolve(content) {
  if(content.type == "embed") {
    return content.content;
  } else if(content.type == "include") {
    return fs.readFileSync("includes/"+content.path);
  } else {
    console.log("Unknown file type "+content.type);
    return "";
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
      creationDate: new Date(),
      header: Import("header.html"),
      footer: Import("footer.html"),
      post: Import("post.html"),
      style: "includes/style.css",
      posts: [],
      raws: []
    }));

    fs.mkdirSync("includes");
    fs.writeFileSync("includes/header.html", fs.readFileSync("default/header.html"));
    fs.writeFileSync("includes/footer.html", fs.readFileSync("default/footer.html"));
    fs.writeFileSync("includes/post.html", fs.readFileSync("default/post.html"));
    fs.writeFileSync("includes/style.css", fs.readFileSync("default/style.css"));

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
  var config = JSON.parse(fs.readFileSync("./tiny.json"));
  prompt.start();
  prompt.get(["Post Title"], function(err, result) {
    var title = result["Post Title"];
    var fileId = title.replace(/ /g, "-");

    config.posts.push({
      title: title,
      fileId: fileId,
      content: Import(fileId+".md"),
      date: new Date()
    });

    fs.writeFileSync("./tiny.json", JSON.stringify(config));

    require("child_process").spawn(process.env.EDITOR || 'vi', ["includes/"+fileId+".md"], {stdio: 'inherit'});
  })
}

function publishPage(config, content, extras) {
  // a page is header + contnet + footer
  var page = Resolve(config.header) + Resolve(content) + Resolve(config.footer);

  var includes = '<link rel="stylesheet" type="text/css" href="'+config.style+'"/>';

  var startYear = (new Date(config.creationDate)).getFullYear();
  var endYear = (new Date()).getFullYear();
  var life = (startYear == endYear) ? startYear : startYear + "-" + endYear;

  // resolve %%TINY_*%%
  page = page.replace(/%%TINY_BLOG_NAME%%/g, config.blogName)
             .replace(/%%TINY_BLOG_AUTHOR%%/g, config.blogAuthor)
             .replace(/%%TINY_INCLUDES%%/g, includes)
             .replace(/%%TINY_LIFE%%/g, life);

  Object.keys(extras).forEach(function(key) {
    if(key[0] == "%") {
      page = page.replace(new RegExp(key, "g"), extras[key]);
    }
  });

  return page;
}

function publish() {
  var configFile = JSON.parse(fs.readFileSync("tiny.json"));

  var publishablePages = [
    {
      "path":"index.html",
      "content": Embed("testing")
    }
  ];

  configFile.posts.forEach(function(post) {
    publishablePages.push(
      {
        "path": post.fileId+".html",
        "content": configFile.post,
        "%%TINY_POST_TITLE%%": post.title,
        "%%TINY_POST_CONTENT%%": marked(Resolve(post.content).toString()),
        "%%TINY_POST_DATE%%": post.date
      }
    );
  });
  publishablePages.forEach(function(page) {
    fs.writeFileSync(page.path, publishPage(configFile, page.content, page));
  })
}

// perform desired action
({ init: init, blog: blog, publish: publish })[process.argv[2]]();
