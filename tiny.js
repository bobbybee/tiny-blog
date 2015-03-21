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
      index: Import("index.html"),
      style: "includes/style.css",
      posts: [],
      raws: []
    }));

    fs.mkdirSync("includes");
    ["header", "footer", "index", "post", "style"].forEach(function(rsrc) {
      fs.writeFileSync("includes/"+rsrc+".html", fs.readFileSync("default/"+rsrc+".html"));
    })

    // setup git if necessary
    if(result["Git Remote"].length) {
      exec(
        "git init . && git remote add origin "+result["Git Remote"] + " && git push origin master",
        function(){} // does it matter at this point?
      );
    }
  })
}

function blog() {
  var config = JSON.parse(fs.readFileSync("./tiny.json"));
  prompt.start();
  prompt.get(["Post Title", "Optional Subtitle"], function(err, result) {
    var title = result["Post Title"];
    var fileId = title.replace(/ /g, "-");

    config.posts.push({
      title: title,
      subtitle: result["Optional Subtitle"],
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

  if(page.indexOf('%%TINY_BEGIN_POST_ITERATION%%') > -1) {
    var b = page.slice(page.indexOf('%%TINY_BEGIN_POST_ITERATION%%') + '%%TINY_BEGIN_POST_ITERATION%%'.length,
      page.indexOf('%%TINY_END_POST_ITERATION%%'));

    var iterated = "";
    config.posts.forEach(function(post) {
      var block = b.replace(/%%TINY_ITERATED_POST_TITLE%%/g, post.title)
        .replace(/%%TINY_ITERATED_POST_DATE%%/g, new Date(post.date).toGMTString())
        .replace(/%%TINY_ITERATED_POST_HREF%%/g, post.fileId.replace(/[^A-Za-z0-9\-]/g,'')+".html")
        .replace(/%%TINY_ITERATED_POST_SUBTITLE%%/g, post.subtitle || "");
      iterated = block + iterated;
    });

    page = page.slice(0, page.indexOf('%%TINY_BEGIN_POST_ITERATION%%'))
          + iterated
          + page.slice(page.indexOf('%%TINY_END_POST_ITERATION%%') + '%%TINY_END_POST_ITERATION%%'.length);
  }

  if(config.gitRemote.length) {
    exec(
      "git add "+extras.path,
      function(){} // does it matter at this point?
    );
  }

  return page;
}

function publish() {
  var configFile = JSON.parse(fs.readFileSync("tiny.json"));

  var publishablePages = [
    { "path": "index.html", "content": configFile.index }
  ];

  configFile.posts.forEach(function(post) {
    publishablePages.push(
      {
        "path": post.fileId.replace(/[^A-Za-z0-9\-]/g,'')+".html",
        "content": configFile.post,
        "%%TINY_POST_TITLE%%": post.title,
        "%%TINY_POST_CONTENT%%": marked(Resolve(post.content).toString()),
        "%%TINY_POST_DATE%%": new Date(post.date).toGMTString(),
        "%%TINY_POST_SUBTITLE%%": post.subtitle || ""
      }
    );
  });

  publishablePages.forEach(function(page) {
    fs.writeFileSync(page.path, publishPage(configFile, page.content, page));
  })

  if(configFile.gitRemote.length) {
    prompt.start();
    prompt.get(["Git Commit Message"], function(err, result) {
      exec(
        "git commit -m "+JSON.stringify(result["Git Commit Message"])+" && git push origin master",
        function(){} // does it matter at this point?
      );
    })
  }
}

// perform desired action
({ init: init, blog: blog, publish: publish })[process.argv[2]]();
