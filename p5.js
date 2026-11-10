// Fonts
let helvet;
let bodoni;
let timesNR;
let p5Day;

// Canvas Elements
let canvas;
let daySet;
let monthSet;
let yearSet;
let weatherSet;
let daysOfWeek;
let dayText;
let timeOfDay;
let lengthTimeTxt;
let weatherOptions;
let weatherImgs;
let scaleFactor;

// Interactive Elements
let daySelect;
let monthSelect;
let yearInput;
let weatherSelect;
let timeInput;
let saveBtn;

function preload() {
  helvet = loadFont('HelveticaNowDisplayXBlk.otf');
  bodoni = loadFont('BOD.TTF');
  timesNR = loadFont('timesbd.ttf');
  p5Day = loadFont('P5DayOfWeek.ttf');
  weatherImgs = [loadImage('Weather Icons/Sun.png'), loadImage('Weather Icons/Cloud.png'), 
                 loadImage('Weather Icons/Umbrella.png'), loadImage('Weather Icons/Snow.png'),
                 loadImage('Weather Icons/Moon.png')]
  weatherOptions = ["SUNNY", "CLOUDY", "RAINY", "SNOWY", "NIGHT"];
}

function setup() {
  scaleFactor = 1;
  
  angleMode(DEGREES);
  canvas = createCanvas(500 * scaleFactor, 500 * scaleFactor, P2D);
  textAlign(CENTER, CENTER);
  background('rgba(0, 0, 0, 0.5)');
  
  push();
  textFont(helvet);
  fill('rgba(255, 255, 255, 1)');
  textSize(50);
  textAlign(LEFT);
  scale(0.4, 1);
  text("Month / Day / Year (0000 - 9999)", 5, 470 * scaleFactor);
  pop();
  
  monthSelect = createSelect();
  monthSelect.position(0, 500 * scaleFactor);
  monthSelect.option("Current Month");
  for (let i = 1; i < 13; i++)
    monthSelect.option(i);
  monthSelect.changed(changeMonth);
  
  yearInput = createInput("" + year());
  yearInput.position(205, 500 * scaleFactor);
  yearInput.input(changeYear);
  
  resetDaySelect();
  
  daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  monthsOfYear = ["JAN", "FEB", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC"]
  daySet = day();
  monthSet = month();
  yearSet = year();
  dayText = daysOfWeek[doomsdayAlg()];
  monthText = monthsOfYear[monthSet-1];
  
  weatherSelect = createSelect();
  weatherSelect.position(0, 500 * scaleFactor + 21);
  for (let i = 0; i < weatherOptions.length; i++) {
    weatherSelect.option(weatherOptions[i]);
  }
  weatherSelect.changed(changeWeather);
  weatherSet = weatherSelect.value();
  
  if (hour() >= 3 && hour() < 7) {
    timeOfDay = "Early\nMorning";
    lengthTimeTxt = "Morning";
  } else if (hour() >= 7 && hour() < 12) {
    timeOfDay = "Daytime";
    lengthTimeTxt = timeOfDay;
  } else if (hour() >= 12 && hour() < 14) {
    timeOfDay = "Lunchtime";
    lengthTimeTxt = timeOfDay;
  } else if (hour() >= 14 && hour() < 18) {
    timeOfDay = "Afternoon";
    lengthTimeTxt = timeOfDay;
  } else if (hour() >= 18 && hour() < 22) {
    timeOfDay = "Evening";
    lengthTimeTxt = timeOfDay;
  } else {
    timeOfDay = "Nighttime";
    lengthTimeTxt = timeOfDay;
  }
  
  timeInput = createInput(timeOfDay);
  timeInput.position(74, 500 * scaleFactor + 21);
  timeInput.input(changeTimeOfDay);
  
  saveBtn = createButton("Save");
  saveBtn.position(348, 500 * scaleFactor);
  saveBtn.mouseReleased(saveCreation);
  
  drawDate();
}

// ----- P5 Date -----

function drawDate() {
  push();
  
  translate(45 * scaleFactor, -30 * scaleFactor);
  scale(scaleFactor);
  
  // White BG
  drawDayPart(255, 60);
  drawMonthPart(255, 50);
  drawDayText(255, 255, 120);
  drawTimeText(255, 3);
  
  push();
  fill(255);
  stroke(255);
  strokeWeight(25);
  quad(38, 310, 149, 244, 161, 257, 60, 340);
  quad(60, 324, 160, 245, 170, 256, 87, 340);
  if (daySet >= 10) {
    quad(186, 180, 271, 172, 260, 323, 210, 329);
  }
  quad(113, 214, 200, 224, 189, 272, 95, 265);
  pop();
  
  // Weather BG
  push();
  fill(255);
  strokeWeight(0);
  rotate(-20.3);
  
  if (daySet >= 10)
    square(215, 260, 118);
  else
    square(145, 260, 118);
  
  pop();
  
  // Black Middle
  drawDayPart(0, 35);
  drawMonthPart(0, 30);
  drawDayText(0, 0, 60);
  drawTimeText(0, 0);
  drawWeather(weatherSet);
  
  push();
  fill(0);
  stroke(0);
  strokeWeight(0);
  quad(38, 310, 149, 244, 161, 257, 60, 340);
  quad(55, 324, 160, 245, 170, 256, 87, 340);
  
  if (daySet >= 10)
    quad(186, 180, 271, 172, 260, 323, 210, 329);
  
  if (monthSet >= 10)
    quad(30, 214, 200, 224, 189, 272, 50, 310);
  else {
    if (monthSet == 7)
      quad(50, 214, 200, 224, 189, 272, 80, 300);
    else
      quad(95, 214, 200, 224, 189, 272, 80, 300);
  }
  
  pop();
  
  // FG
  drawDayPart(255, 0);
  drawMonthPart(255, 0);
  drawDayText('rgba(0, 0, 0, 0.75)', 0, 0);
  if (dayText == "SAT") {
    drawDayText('rgba(0, 0, 0, 0)', 'rgba(0, 247, 231, 1)', 10);
  }
  else if (dayText == "SUN") {
    drawDayText('rgba(0, 0, 0, 0)', 'rgba(247, 1, 4, 1)', 10);
  }
  else {
    drawDayText('rgba(0, 0, 0, 0)', 255, 10);
  }
  
  push();
  fill(255);
  stroke(255);
  strokeWeight(0);
  quad(67, 304, 134, 261, 138, 267, 72, 313);
  pop();
  
  pop();
}

function drawDayPart(color, weight) {
  push();
  textFont(helvet);
  textSize(500 / 3);
  
  fill(color);
  stroke(color);
  strokeWeight(weight);
  scale(0.67, 1, 1);
  
  if (floor(daySet / 10) == 0) {
    rotate(3.6);
    text(daySet, 320, 210);
    
  } else {
    rotate(-5.6);
    text(floor(daySet / 10), 250, 250);
    rotate(5.6);

    rotate(3.6);
    text(daySet - (floor(daySet / 10) * 10), 420, 190);
  }
  
  pop();
}

function drawMonthPart(color, weight) {
  push();
  textFont(bodoni);
  textSize(400 / 4);
  
  fill(color);
  stroke(color);
  strokeWeight(weight);
  scale(1.09 * 0.9, 1 * 0.9, 1);
  translate(-20, 40);
  
  if (floor(monthSet / 10) == 0) {
    if (monthSet == 1 || monthSet == 4 || monthSet == 6 || monthSet == 8 || monthSet == 9) {
      textFont(timesNR);
    }
    rotate(4.9);
    shearX(-8.3);
    text(monthText, 130, 210);
    
  } else {
    push();
    textFont(timesNR);
    textSize(450 / 3);
    rotate(4.9);
    shearX(-1.6);
    text(1, 45, 210);
    pop();
    
    if (monthSet - 10 == 0 || monthSet - 10 == 1) {
      textFont(timesNR);
    }
    rotate(4.9);
    shearX(-8.3);
    //text(monthsOfYear[monthSet - 10], 130, 210);
    text(monthText, 130, 210);
  }
  
  pop();
}

function drawDayText(fillCol, strokeCol, weight) {
  push();
  
  textFont(helvet);
  textAlign(LEFT, TOP);
  translate(155, 285);
  scale(0.3, 0.3, 1);
  rotate(-14);
  
  fill(fillCol);
  stroke(strokeCol);
  strokeWeight(weight);
  //scale(0.67, 1, 1);
  
  // For mimicing actual P5 days
  // push();
  // textFont(p5Day);
  // textSize(51.4);
  // fill('rgba(0, 0, 0, 0.5)');
  // text(6, -7, 65);
  // pop();
  
  if (dayText == "MON") {
    push();
    createDayLetter(0.47, 236.3, -3.1, 3.1, "M", 0, -10);
    createDayLetter(0.48, 256.5, 0, 0, "o", 116.5, -42.9);
    createDayLetter(0.44, 230.2, -3.4, 2.4, "N", 176.3, 25.3);
    createDayLetter(0.37, 244.8, 2.8, -7.9, "D", 275, -60);
    createDayLetter(0.6, 235.8, -2.5, 0, "a", 330, 15);
    createDayLetter(0.51, 263.5, -2.7, 0, "Y", 400, 24);
    pop();
  }
  else if (dayText == "TUE") {
    push();
    createDayLetter(0.53, 296.7, -8.8, 0, "T", 0, -16.2);
    createDayLetter(0.5, 233.1, -2.1, 0, "U", 94.5, 43);
    createDayLetter(0.39, 245.2, -2.8, 0, "E", 182.1, 19.7);
    createDayLetter(0.43, 245.2, -0.5, 0, "S", 255, 13);
    createDayLetter(0.43, 264.3, -2.3, 0, "D", 329.1, 10);
    createDayLetter(0.5, 231.4, 3.5, 0, "A", 421, -36.1);
    createDayLetter(0.5, 269.6, -1.7, 0, "Y", 485, 2.9);
    pop();
  }
  else if (dayText == "WED") {
    push();
    createDayLetter(0.47, 267.5, -6.4, 6.4, "W", 0, 0);
    createDayLetter(0.45, 303.7, -10, 15.5, "e", 70, 10);
    createDayLetter(0.37, 273.1, -5, 7, "D", 187, 30);
    createDayLetter(0.38, 264.1, -1, 0, "N", 285, 12);
    createDayLetter(0.34, 250.6, -1, 0, "E", 365, 11);
    createDayLetter(0.40, 227.6, -1, 0, "S", 425, 48);
    createDayLetter(0.36, 251.6, -2.8, 0, "D", 485, 64);
    createDayLetter(0.60, 235.8, -2.5, 0, "a", 545, 75);
    createDayLetter(0.51, 267.4, -7.7, 0, "Y", 590, 150);
    pop();
  }
  else if (dayText == "THU") {
    push();
    createDayLetter(0.53, 296.7, -4, 5, "T", 0, -20);
    createDayLetter(0.47, 245.5, -5.3, 0, "H", 99.3, 40);
    createDayLetter(0.5, 275.1, -4.6, 0, "u", 187, 0);
    createDayLetter(0.39, 280, 2, 0, "R", 278, -50);
    createDayLetter(0.5, 214.6, -0.5, -2.5, "S", 348, 39);
    createDayLetter(0.43, 247.8, -2.3, -1, "D", 416, 30);
    createDayLetter(0.5, 215.4, 5, 0, "A", 495, -40);
    createDayLetter(0.6, 270.3, 8, -0.5, "Y", 550, -150);
    pop();
  }
  else if (dayText == "FRI") {
    push();
    createDayLetter(0.5, 250, -3.1, 0.4, "F", 0, 18);
    createDayLetter(0.53, 240.2, -4, 0, "R", 95, 19.2);
    createDayLetter(0.44, 282.5, -3.4, 0, "i", 205, 1.5);
    createDayLetter(0.49, 233.9, 0, 0, "D", 255, 1.5);
    createDayLetter(0.81, 235.8, -2.5, 0, "a", 345, 30);
    createDayLetter(0.51, 263.5, -2.7, 0, "Y", 450, 40);
    pop();
  }
  else if (dayText == "SAT") {
    push();
    createDayLetter(0.47, 267.5, -6.4, 6.4, "S", 0, 5);
    createDayLetter(0.56, 192.6, -5, 5, "A", 71.3, 95.3);
    createDayLetter(0.64, 225.9, 3.4, 0, "T", 145, -8);
    createDayLetter(0.67, 167.5, 0, 0, "U", 210, 85);
    createDayLetter(0.49, 250.6, 1.2, 0, "R", 295, -10);
    createDayLetter(0.4, 258.2, -0.2, 0, "D", 385, -12);
    createDayLetter(0.6, 260.2, 4.1, 0, "a", 475, -70);
    createDayLetter(0.53, 267.4, 0.2, 0, "Y", 528, -30);
    pop();
  }
  else if (dayText == "SUN") {
    push();
    createDayLetter(0.48, 273.8, 0, 0, "S", 0, 0);
    createDayLetter(0.49, 299.2, 0, 0, "u", 83.4, -38.8);
    createDayLetter(0.49, 245.2, 4.3, 0, "N", 186.1, -17.8);
    createDayLetter(0.43, 252.1, 0, 0, "D", 283, 14.2);
    createDayLetter(0.53, 217.4, 0, 0, "A", 357.9, 60);
    createDayLetter(0.55, 269.6, 0, 0, "Y", 418.5, 0);
    pop();
  }
  
  pop();
}

function createDayLetter(hScale, size, rot, shear, ltr, x, y) {
  push();
  scale(hScale, 1, 1);
  textSize(size);
  rotate(rot);
  shearX(shear);
  text(ltr, x / hScale, y);
  pop();
}

function drawTimeText(color, weight) {
  let txt = "";
  let txtLength;
  
  let txtList = split(timeOfDay, " ");
  txtLength = txtList[0];
  
  if (txtList.length > 1) {
    restOfWord = "";
    for (let i = 1; i < txtList.length; i++) {
      if (i == txtList.length - 1)
        restOfWord += txtList[i];
      else
        restOfWord += txtList[i] + " ";
    }
    
    if (restOfWord.length > txtLength.length)
      txtLength = restOfWord;
  }
  
  for (let i = 0; i < txtList.length; i++) {
    if (i == txtList.length - 1)
      txt += txtList[i];
    else if (i == 0)
      txt += txtList[i] + "\n";
    else
      txt += txtList[i] + " ";
  }
  
  push();
  
  textFont(helvet);
  textAlign(LEFT, CENTER);
  textLeading(10);
  fill(color);
  stroke(color);
  strokeWeight(weight);
  rotate(-23.6);
  scale(0.4 * 5, 1 * 5, 1);
  
  text(txt, -textWidth(txtLength), 76);
  
  pop();
}

function drawWeather(weather) {
  push();
  
  rotate(-20.3);
  if (daySet >= 10)
    translate(220, 265);
  else
    translate(150, 265);
  
  if (weather == "SUNNY") {
    image(weatherImgs[0], 0, 0);
  } else if (weather == "CLOUDY") {
    image(weatherImgs[1], 0, 0);
  } else if (weather == "RAINY") {
    image(weatherImgs[2], 0, 0);
  } else if (weather == "SNOWY") {
    image(weatherImgs[3], 0, 0);
  } else if (weather == "NIGHT") {
    image(weatherImgs[4], 0, 0);
  }
  
  pop();
}

// Calculates the day of the week using
// John Conway's Doomsday Algorithm
// Returns 0-6 (Sun-Sat)
function doomsdayAlg() {
  // Day for each month in order (Jan, Feb, etc.)
  let doomsdays =     [3, 28, 14, 4, 9, 6, 11, 8, 5, 10, 7, 12];
  let doomsdaysLeap = [4, 29, 14, 4, 9, 6, 11, 8, 5, 10, 7, 12];
  
  let century = floor(yearSet / 100)
  let lastTwo = yearSet - century * 100;
  let anchorDay = (5 * (century % 4) % 7) + 2;
  let doomsday = (floor(lastTwo / 12) + (lastTwo % 12) + floor(lastTwo % 12 / 4) + anchorDay) % 7;
  
  // FUTURE: There HAS to be an optimization to this
  let dayRtn = doomsday;
  if (daySet - doomsdays[monthSet - 1] != 0) {
    if (yearSet % 4 == 0)
      dayRtn = dayFinder(doomsday, doomsdaysLeap, sign(daySet - doomsdays[monthSet - 1]));
    else
      dayRtn = dayFinder(doomsday, doomsdays, sign(daySet - doomsdays[monthSet - 1]));
  } // Assumption: else the day set = the month's doomsday
  
  // console.log(dayRtn);
  
  return dayRtn;
}

// Returns the correct day based on the given doomsday.
// Assumption: the day set - the month's doomsday != 0
function dayFinder(doomsday, doomsdaySet, increment) {
  let rtn = doomsday;
  let greater;
  let lesser;
  
  if (daySet > doomsdaySet[monthSet - 1]) {
    greater = daySet;
    lesser = doomsdaySet[monthSet - 1];
  } else {
    greater = doomsdaySet[monthSet - 1];
    lesser = daySet;
  }
  
  for (let i = lesser; i < greater; i++) {
    rtn += increment;
    if (rtn == 7)
      rtn = 0;
    else if (rtn == -1)
      rtn = 6;
  }
  
  return rtn;
}

function resetCanvas(haveBG) {
  clear();
  
  if (haveBG) {
    background('rgba(0, 0, 0, 0.5)');
    
    push();
    textFont(helvet);
    fill('rgba(255, 255, 255, 1)');
    textSize(50);
    textAlign(LEFT);
    scale(0.4, 1);
    text("Month / Day / Year (0000 - 9999)", 5, 470 * scaleFactor);
    pop();
  }
  else
    background('rgba(0, 0, 0, 0)');
  
  dayText = daysOfWeek[doomsdayAlg()];
  
  drawDate();
}

function changeMonth() {
  if (monthSelect.value() == "Current Month") {
    monthSet = month();
  } else {
    monthSet = monthSelect.value();
  }
  
  if (monthSet == 1 || monthSet == 3 || monthSet == 5 || 
      monthSet == 7 || monthSet == 8 || monthSet == 10 || monthSet == 12) {
    daySet = constrain(daySet, 1, 31);
  } else if (monthSet == 2) {
    if (yearSet % 4 == 0)
      daySet = constrain(daySet, 1, 29);
    else
      daySet = constrain(daySet, 1, 28);
  } else {
    daySet = constrain(daySet, 1, 30);
  }
  
  resetDaySelect();
  resetCanvas(true);
}

function changeDay() {
  if (daySelect.value() == "Current Day") {
    daySet = day();
  } else {
    daySet = daySelect.value();
  }
  
  if (monthSet == 1 || monthSet == 3 || monthSet == 5 || 
      monthSet == 7 || monthSet == 8 || monthSet == 10 || monthSet == 12) {
    daySet = constrain(daySet, 1, 31);
  } else if (monthSet == 2) {
    if (yearSet % 4 == 0)
      daySet = constrain(daySet, 1, 29);
    else
      daySet = constrain(daySet, 1, 28);
  } else {
    daySet = constrain(daySet, 1, 30);
  }
  
  resetCanvas(true);
}

function changeYear() {
  yearSet = constrain(this.value(), 0, 9999);
  
  resetDaySelect();
  resetCanvas(true);
}

function changeWeather() {
  weatherSet = weatherSelect.value();
  resetCanvas(true);
}

function changeTimeOfDay() {
  timeOfDay = this.value();
  resetCanvas(true);
}

function resetDaySelect() {
  let prevSel = "Current Day";
  if (daySelect != null) {
    prevSel = daySelect.selected();
    daySelect.remove();
  }
  daySelect = createSelect();
  daySelect.option("Current Day");
  daySelect.position(110, 500 * scaleFactor);
  
  if (monthSet == 1 || monthSet == 3 || monthSet == 5 || 
      monthSet == 7 || monthSet == 8 || monthSet == 10 || monthSet == 12) {
    for (let i = 1; i <= 31; i++)
      daySelect.option(i);
  } else if (monthSet == 2) {
    if (yearSet % 4 == 0) {
      for (let i = 1; i <= 29; i++)
        daySelect.option(i);
    } else {
      for (let i = 1; i <= 28; i++)
        daySelect.option(i);
    }
  } else {
    for (let i = 1; i <= 30; i++)
      daySelect.option(i);
  }
  
  daySelect.selected(prevSel);
  
  daySelect.changed(changeDay);
}

// ----- P5 Deadline -----

function drawDeadline() {}

function drawConsequence() {}

function drawObjective() {}

function drawSubtasks() {}

// ----- General -----

// Returns the sign of a number (1 or -1)
// Constraint: all x != 0
function sign(x) {
  return x / abs(x);
}

function saveCreation() {
  resetCanvas(false);
  saveCanvas(canvas, "" + monthSet + "_" + daySet + "_" + yearSet + "_P5_Style", 'png');
  resetCanvas(true);
}