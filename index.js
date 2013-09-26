var jsdom = require('jsdom');
var rewire = require('rewire');
var path = require('path');
var fs = require('fs');

var domGlobals = [
  'navigator',
  'document'
];

module.exports.globals = function() { return {} };

// Exposes a stubbed browser API and benv.globals into the node.js global namespace 
// so the current process can act like a browser environment.
// 
// @param {Function} callback

module.exports.setup = function(callback) {
  jsdom.env({
    html: "<html><body></body></html>",
    done: function(errs, w) {
      global.window = w;
      domGlobals.forEach(function(varName) {
        global[varName] = w[varName];
      });
      var globals = module.exports.globals();
      for(var key in globals) {
        global[key] = globals[key];
      }
      if (callback) callback();
    }
  })
}

// Deletes the stubbed browser API, benv.globals, and cleans things up so other 
// tests can run without being harmed.

module.exports.teardown = function() {
  delete global.window;
  domGlobals.forEach(function(varName) {
    delete global[varName];
  });
  for(var key in module.exports.globals) {
    delete global[key];
  }
}

// Require non-commonjs modules by specifying their global variable.
// 
// @param {String} filename Path to non-commonjs file
// @param {String} globalVarName Exposed global like Zepto or GMaps

module.exports.require = function(filename, globalVarName) {
  var fullPath = path.resolve(path.dirname(module.parent.filename), filename);
  var mod = rewire(fullPath);
  var w = mod.__get__('window');
  return w[globalVarName] || mod.__get__(globalVarName);
}

// Renders a server-side template into a fake browser's body.
// Will strip out all script tag first to avoid jsdom trying to run scripts.
// 
// @param {String} filename
// @param {Object} data data passed into template like jade locals

module.exports.render = function(filename, data, callback) {
  if (!window) throw Error('You must run benv.setup first.');
  if (filename.match('.jade')) {
    var html = require('jade').compile(
      fs.readFileSync(filename),
      { filename: filename }
    )(data);
    jsdom.env(html, function(err, w) {
      var scriptEls = w.document.getElementsByTagName('script');
      Array.prototype.forEach.call(scriptEls, function(el) {
        el.parentNode.removeChild(el);
      });
      var bodyHtml = w.document.getElementsByTagName('body')[0].innerHTML;
      document.getElementsByTagName('body')[0].innerHTML = bodyHtml;
      if (callback) callback();
    });
  } else {
    throw Error('Could not identify template type');
  }
}