/** 
 * This file contains functions for creating new SVG objects.
 * 
 * You must implement the required functions. 
 * 
 * You are encouraged to implement more helper functions here if you need to. 
 * 
 * You may find a tutorial on SVG at: http://www.w3schools.com/svg/ 
 */ 

//  Namespace for SVG elements, different than normal HTML element namespace.
var SVGNameSpace = "http://www.w3.org/2000/svg";

var colorControlObject = {
  squareFill : 'rgb(245, 227, 214)',
  squareStroke : 'rgb(234, 200, 174)'
};

/**
 * Makes a new SVG line object and returns it. 
 *
 * @param x1 {number} 
 * @param y1 {number}
 * @param x2 {number}
 * @param y2 {number}
 * @param color {string} the color of the line
 * @param stroke {number} the thickness of the line.
 * @returns {object}
 *
 * This has been implemented to provide an example. 
 */
function makeLine(x1, y1, x2, y2, color, stroke) {

  var e = document.createElementNS(SVGNameSpace, "line");
  e.setAttribute("x1", x1);
  e.setAttribute("y1", y1);
  e.setAttribute("x2", x2);
  e.setAttribute("y2", y2);

  e.style.stroke      = color || "#000000";
  e.style.strokeWidth = stroke || 2;

  return e;

}

/**
* Makes and returns a new SVG square object. 
* 
* @param x {number} the x position of the square.
* @param y {number} the y position of the square.
* @param length {string} the side length of the square.
* 
* @return {object} 
*/ 
function makeSquare(x, y, length){
  var square = document.createElementNS(SVGNameSpace, "rect"); 

	square.setAttribute("x", x);
	square.setAttribute("y", y);
	square.setAttribute("width", length);
	square.setAttribute("height", length);
	square.setAttribute("class", "board-white");
	square.style.fill = colorControlObject.squareFill;
	square.style.stroke = colorControlObject.squareStroke;
	square.style.strokeWidth = 2;

  return square; 
}


/**
* Makes and returns a new SVG token object. 
* 
* @param X {number} the x coordinate of the token on the Go board.
* @param Y {number} the y coordinate of the token on the Go board.
* @param w {number} the width of the image (assumes a square image)
* @param src {number} the source of the image file for the token
* @param className {string} class name
* @param onClick {function} the function to call on a click event
* 
* @return {object} 
*/
function makeToken(X, Y, w, src, className, onClick){

  var token = document.createElementNS('http://www.w3.org/2000/svg','image');

  token.setAttributeNS('http://www.w3.org/1999/xlink','href', src);
  token.setAttribute("x", X*w+w/2+"%");
  token.setAttribute("y", Y*w+w/2+"%");
  token.setAttribute("X", X);
  token.setAttribute("Y", Y);
  token.setAttribute("width", w+"%");
  token.setAttribute("height", w+"%");
  token.setAttribute("class", className);
  if (onClick)
    token.onclick = onClick;

  return token;

}

function makeUnreadMessagesCircle() {
  var shape = document.createElementNS(SVGNameSpace, "circle");
  shape.setAttribute("cx", 4);
  shape.setAttribute("cy", 4);
  shape.setAttribute("r",  3);
  shape.setAttribute("class", "unread-circle");

  return shape;
}

function makeUnreadMessagesSvg() {
  var s = document.createElementNS(SVGNameSpace, "svg"); 
  s.setAttribute("class", "unread-svg initially-hidden");
  return s;
}

/**
* Makes an SVG element which fills the parent vertically
* and is square in shape
*
* @return {object} 
*/
function makeSVG(w, h, id){
  var s = document.createElementNS(SVGNameSpace, "svg"); 
  s.setAttribute("width", w); 
  s.setAttribute("height", w);
  s.setAttribute("id", id);
  s.setAttribute('xmlns', SVGNameSpace);
  s.setAttribute('xmlns:xlink',"http://www.w3.org/1999/xlink");
  return s;
}
