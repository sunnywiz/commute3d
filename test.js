const cad = require ('jscad'); 
const fs = require('fs'); 
const csvdata = require("csvdata");
const glob = require("glob");
const bluebird = require("bluebird");

var config = { 
  // input files
  trackFiles: "input/trackLog*.csv",
  csvLatitudeColumn: " Latitude",
  csvLongitudeColumn: " Longitude",
  csvTimeColumn: " Device Time",
  
  // generated dimensions
  printX: 100,
  printY: 100,
  printZ: 100,
  printRadius: 1

};

function readTrack(fileName) { 
  return new Promise((resolve,reject)=> { 
    csvdata
      .load(fileName)
      .then(function(contents) { 
        var result = []; 
        contents.forEach(function(line)  { 
          if (line[config.csvLatitudeColumn] && typeof(line[config.csvLatitudeColumn])=='number' &&
              line[config.csvLongitudeColumn] && typeof(line[config.csvLongitudeColumn])=='number' && 
              line[config.csvTimeColumn]) 
          { 
            var lat = line[config.csvLatitudeColumn];  
            var long = line[config.csvLongitudeColumn]; 
            var time = Date.parse(line[config.csvTimeColumn]);
            result.push({lat:lat, long:long, time:time});
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
  return new Promise((resolve,reject)=>{
    glob(config.trackFiles, {}, function(er, files) { 
      bluebird.map(files,function(fileName) { 
        return readTrack(fileName);
      })
      .then(function(result) { resolve(result);});
    }); // glob
  }); // return promise
}

readTracks()
.then(console.log);

/*
var clat = " Latitude"; 
var clon = " Longitude"; 
var ctime = " Device Time";

var olat = 38.30081015;
var olon = -85.47210991666667;

var model = CSG.cube({size:1});

var p = csvdata
  .load("input/trackLog-2012-Dec-30_18-26-55.csv")
  .then(function(x) { 
    x.forEach(function(y)  { 
      if (y[clat] && y[clon] && y[ctime] && typeof(y[clat])=='number') { 
        var lat = y[clat] - olat;  
        var long = y[clon] - olon; 
        var time = Date.parse(y[ctime]);
        var cube = CSG.cube({size:1}).translate([long*1000,lat*1000,0]);
        model = model.union(cube); 
        console.log(time);
      }
    });
    cad.renderFile(model,'output.stl');  
  }); 
*/