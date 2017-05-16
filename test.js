const cad = require('jscad');
const fs = require('fs');
const csvdata = require("csvdata");
const glob = require("glob");
const bluebird = require("bluebird");

var config = {
  // input files
  trackFiles: "input/Home*Work*.csv",
  csvLatitudeColumn: "LAT",
  csvLongitudeColumn: "LON",
  csvTimeColumn: "TIME",
  
  // filtering out non-applicable tracks
  minLat: 38.214872,
  minLong: -85.656204,
  maxLat: 38.356757,
  maxLong: -85.453142,

  // generated dimensions
  printX: 75,
  printY: 75,
  printZ: 50,
  printRadius: 1.5,

  // extra supports
  extraSupportsEvery: 20

};

function readTrack(fileName) {
  return new Promise((resolve, reject) => {
    csvdata
      .load(fileName)
      .then(function (contents) {
        var result = [];
        contents.forEach(function (line) {
          if (line[config.csvLatitudeColumn] && typeof (line[config.csvLatitudeColumn]) == 'number' &&
            line[config.csvLongitudeColumn] && typeof (line[config.csvLongitudeColumn]) == 'number' &&
            line[config.csvTimeColumn]) {
            var lat = line[config.csvLatitudeColumn];
            var long = line[config.csvLongitudeColumn];
            var time = Date.parse(line[config.csvTimeColumn]);
            result.push({ lat: lat, long: long, time: time });
          }
        });
        resolve(result);
      });
  });
}

// returns an array of tracks
// each track is an array of { time: , lat: , long: }
// where the time has been reset to start at zero. 
function readTracks() {
  return new Promise((resolve, reject) => {
    glob(config.trackFiles, {}, function (er, files) {
      bluebird.map(files, fileName => readTrack(fileName))
        .then(resolve);
    }); // glob
  }); // return promise
}

function trackGetBounds(track, bounds) {
  if (!bounds) {
    bounds = { x1: undefined, x2: undefined, y1: undefined, y2: undefined, t1: undefined, t2: undefined };
  }
  track.forEach(point => {
    if (bounds.x1 === undefined || point.long < bounds.x1) bounds.x1 = point.long;
    if (bounds.x2 === undefined || point.long > bounds.x2) bounds.x2 = point.long;
    if (bounds.y1 === undefined || point.lat < bounds.y1) bounds.y1 = point.lat;
    if (bounds.y2 === undefined || point.lat > bounds.y2) bounds.y2 = point.lat;
    if (bounds.t1 === undefined || point.time < bounds.t1) bounds.t1 = point.time;
    if (bounds.t2 === undefined || point.time > bounds.t2) bounds.t2 = point.time;
  });
  return bounds;
}

function tracksGetBounds(tracks) {
  bounds = { x1: undefined, x2: undefined, y1: undefined, y2: undefined, t1: undefined, t2: undefined };
  tracks.forEach(track => bounds = trackGetBounds(track, bounds));
  return bounds;
}

function trackSquashTimeComponent(track) {
  var bounds = trackGetBounds(track);
  track.forEach(p => { p.time -= bounds.t1 });
}

function trackRescale(track, bounds, config) {
  var xs = (config.printX) / (bounds.x2 - bounds.x1);
  var ys = (config.printY) / (bounds.y2 - bounds.y1);
  var ts = (config.printZ) / (bounds.t2 - bounds.t1);

  track.forEach(p => {
    p.long = (p.long - bounds.x1) * xs;
    p.lat = (p.lat - bounds.y1) * ys;
    p.time = (p.time - bounds.t1) * ts;
  });
}

function fancyUnion(m, i) {
  //console.log("fancyunion(" + m.length + "," + i + ")");
  if (m.length == 1) return m[0];
  if (m.length == 2) {
    return m[0].union(m[1]);
  }
  var midpoint = Math.floor(m.length / 2);
  var part1 = m.slice(0, midpoint + 1);
  var part2 = m.slice(midpoint + 1);
  var union1 = fancyUnion(part1, i + 1);
  var union2 = fancyUnion(part2, i + 1);
  //console.log("  got back u1[0.." + midpoint + "]=" + union1.polygons.length);
  //console.log("  got back u2[" + (midpoint + 1) + ".." + (m.length - 1) + "]=" + union2.polygons.length);
  var u = union1.union(union2);
  //console.log("  unioned to " + u.polygons.length);
  return u;
}

function tracksExcludeOutOfArea(tracks) {
  var goodTracks = [];
  tracks.forEach(track => {
    var isGood = true;
    if (track.length > 10) {
      for (var i = 0; i < track.length; i++) {
        var lat = track[i].lat;
        var long = track[i].long;
        if (lat < config.minLat || lat > config.maxLat ||
          long < config.minLong || long > config.maxLong) {
          isGood = false;
          break;
        }
      }
    } else { 
      isGood = false; 
    }
    if (isGood) goodTracks.push(track);
  });
  return goodTracks;
}

readTracks()
  .then(tracks => {
    console.log("Starting with " + tracks.length + " tracks");
    tracks = tracksExcludeOutOfArea(tracks);
    console.log("Left with " + tracks.length + " good tracks");
    tracks.forEach(trackSquashTimeComponent);
    var bounds = tracksGetBounds(tracks);
    console.log(bounds);
    tracks.forEach(track => trackRescale(track, bounds, config));
    var bounds2 = tracksGetBounds(tracks);
    console.log(bounds2);

    var modelBits = [];
    var desiredDistance = Math.pow(config.printRadius, 2);
    var desiredPillarDistance = Math.pow(config.extraSupportsEvery, 2);

    for (var i1 = 0; i1 < tracks.length; i1++) {
      var track = tracks[i1];
      if (track.length < 3) continue;
      var previousIndex = 0;

      modelBits.push(new CSG.sphere({
        center: [track[previousIndex].long, track[previousIndex].lat, track[previousIndex].time],
        radius: config.printRadius / 2,
        resolution: 8
      }));

      // Ground -- technically should be the same as above.
      modelBits.push(new CSG.sphere({
        center: [track[previousIndex].long, track[previousIndex].lat, 0],
        radius: 1.5*(config.printRadius / 2),
        resolution: 8
      }));

      var lastPillarIndex = 0; 

      for (var i2 = 1; i2 < track.length; i2++) {

        var distsq = Math.pow(track[i2].long - track[previousIndex].long, 2) +
          Math.pow(track[i2].lat - track[previousIndex].lat, 2) +
          Math.pow(track[i2].time - track[previousIndex].time, 2);
        if (i2 < track.length - 1 && distsq < desiredDistance) continue;

        modelBits.push(new CSG.sphere({
          center: [track[i2].long, track[i2].lat, track[i2].time],
          radius: config.printRadius / 2,
          resolution: 8
        }));
        modelBits.push(new CSG.cylinder({
          start: [track[previousIndex].long, track[previousIndex].lat, track[previousIndex].time],
          end: [track[i2].long, track[i2].lat, track[i2].time],
          radius: config.printRadius / 2,
          resolution: 8
        }));

        // Ground: 
        modelBits.push(new CSG.sphere({
          center: [track[i2].long, track[i2].lat, 0],
          radius: 1.5*config.printRadius / 2,
          resolution: 8
        }));
        modelBits.push(new CSG.cylinder({
          start: [track[previousIndex].long, track[previousIndex].lat, 0],
          end: [track[i2].long, track[i2].lat, 0],
          radius: 1.5*config.printRadius / 2,
          resolution: 8
        }));

        let wantPillar = false; 
        if (i2 == track.length - 1) {
          wantPillar = true; 
        }

        var distanceSinceLastPillar = 
          Math.pow(track[i2].long - track[lastPillarIndex].long, 2) +
          Math.pow(track[i2].lat - track[lastPillarIndex].lat, 2) +
          Math.pow(track[i2].time - track[lastPillarIndex].time, 2);
        if (distanceSinceLastPillar > desiredPillarDistance) { 
          wantPillar = true; 
          lastPillarIndex = i2; 
        }

        if (wantPillar) {
          // pillar
          modelBits.push(new CSG.cylinder({
            start: [track[i2].long, track[i2].lat, 0],
            end: [track[i2].long, track[i2].lat, track[i2].time],
            radius: 1.5*config.printRadius / 2,
            resolution: 4
          }));
        }

        previousIndex = i2;
      }
    }

    cad.renderFile(modelBits, 'output.stl');

    // console.time("fancyUnion")
    // var modelBits1 = fancyUnion(modelBits,1);
    // console.timeEnd("fancyUnion");

    // cad.renderFile(modelBits1, 'union.stl');

  });
