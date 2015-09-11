/**
 * src: https://github.com/mpd106/metalsmith-browserify/blob/master/lib/index.js
 */
/* global -Promise */
var browserify = require('browserify');
var path = require('path');
var Promise = require('promise');
var writeFile = Promise.denodeify(require('fs').writeFile);
var mkdirp = Promise.denodeify(require('mkdirp'));

/**
 * Metalsmith plugin to browserify specified JS files
 *
 * @param {Object} options
 *   @property {Array} files
 *   @property {String} dest
 *   @property {Boolean} excludeOtherSources
 *   @property {Array} transforms
 *   @property {Boolean} emitSourceMap
 */
module.exports = function(opts) {
  if (!opts.files) throw new Error("'files' option required");
  if (!opts.dest) throw new Error("'dest' option required");
  if (typeof opts.excludeOtherSources === 'undefined' ||
      opts.excludeOtherSources === null) opts.excludeOtherSources = true;
  if (!opts.transforms) opts.transforms = [];
  if (!opts.debug) opts.debug = false;

  return function(files, metalsmith, done) {
    var sourceFileNames = opts.files.map(function(file) {
      return path.join(metalsmith.source(), file);
    });
    var destinationFileName = opts.dest;

    var metalsmithDestinationPath = metalsmith.destination();
    var destinationFilePath = path.join(metalsmithDestinationPath, destinationFileName);
    var destinationFolder = path.dirname(destinationFilePath);

    var writeOutputFile = writeFile.bind(null, destinationFilePath);

    var applyTransforms = function(browserify, transforms) {
      transforms.forEach(function(transform) {
        browserify.transform(transform);
      });
    };

    var runBrowserify = function() {
      return new Promise(function(fulfill, reject) {
        var b = browserify(sourceFileNames, { debug: opts.emitSourceMap });
        applyTransforms(b, opts.transforms);
        b.bundle(function(err, buffer) {
          if (err) reject(err);
          else fulfill(buffer);
        });
      });
    };

    var removeClashingSourceFiles = function() {
      var check = function(fileInDestinationPath, destinationFilePath) {
        return fileInDestinationPath === destinationFilePath;
      };
      removeMatchingFiles(check);
    };

    var removeOtherJsFiles = function() {
      if (!opts.excludeOtherSources) return;
      var check = function(fileInDestinationPath, destinationFilePath) {
        return fileInDestinationPath !== destinationFilePath &&
          path.extname(fileInDestinationPath) === '.js';
      };
      removeMatchingFiles(check);
    };

    var removeMatchingFiles = function(check) {
      var fileNames = Object.keys(files);
      var matchingFileNames  = fileNames.filter(function(fileName) {
        var fileInDestinationPath = path.join(metalsmithDestinationPath, fileName);
        return check(fileInDestinationPath, destinationFilePath);
      });
      matchingFileNames.forEach(function(fileName) {
        delete files[fileName];
      });
    };

    mkdirp(destinationFolder)
      .then(runBrowserify)
      .then(writeOutputFile)
      .then(removeClashingSourceFiles)
      .then(removeOtherJsFiles)
      .done(function() {
        done();
      }, function(err) {
        done(err);
      });
  };
};
