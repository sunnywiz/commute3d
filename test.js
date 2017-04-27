// var cad = require ('jscad'); 
// var c = cube({size:[2,4,96]});
// cad.renderFile(c, 'output.stl'); 

const fs = require('fs'); 
var csvdata = require("csvdata");

var clat = " Latitude"; 
var clon = " Longitude"; 
var ctime = " Device Time";
var p = csvdata.load("input/trackLog-2012-Dec-30_18-26-55.csv");

p.then(function(x) { 
  x.forEach(function(y)  { 
    if (y[clat] && y[clon] && y[ctime]) { 
      var lat = y[clat]; 
      var long = y[clon]; 
      var time = Date.parse(y[ctime]);
      console.log(time);  
    }
  });
}); 
  
