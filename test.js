var cad = require ('jscad'); 

var c = cube({size:[2,4,96]});

cad.renderFile(c, 'output.stl'); 
