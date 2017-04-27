const cad = require ('jscad'); 
const fs = require('fs'); 
var csvdata = require("csvdata");

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
