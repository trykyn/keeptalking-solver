"use strict";
  
var keepTalkingApp = angular.module('keepTalkingSolverApp',[])
  .controller('keepTalkingSolverController', ['$scope', function($scope) {
    
  // ===========================================================================
  //  "Globals"
  // ===========================================================================
    
  var enumColors = Object.freeze({  "BLACK": "Black"
                                  , "BLUE": "Blue"
                                  , "GREEN": "Green"
                                  , "RED": "Red"
                                  , "WHITE" : "White"
                                  , "YELLOW" : "Yellow" }),
     enumIndicators = Object.freeze({    "CAR": "car"
                                       , "FRK": "frk" }),
     enumButtonText = Object.freeze({  "ABORT": "abort"
                                     , "DETONATE": "detonate"
                                     , "HOLD": "hold"
                                     , "OTHER": "other" });

  // Defaults
  $scope.selectedWires = [];
  $scope.wireSequence = [];
  $scope.complicatedWires = [];
  $scope.button = { "text": undefined, "color": undefined };
  $scope.numStrikes = 0;
  $scope.simonSaysSequence = [];
  $scope.memoryStages = [];

  var passwordPool = ['about','after','again','below','could','every','first',
                      'found','great','house','large','learn','never','other',
                      'place','plant','point','right','small','sound','spell',
                      'still','study','their','there','these','thing','think',
                      'three','water','where','which','world','would','write'],
      wireCutSequence = {
        'Red': ['C', 'B', 'A', 'A or C', 'B', 'A, C', 'A, B, C', 'A, B', 'B'],
        'Blue': ['B', 'A, C', 'B', 'A', 'B', 'B, C', 'C', 'A, C', 'A'],
        'Black': ['A, B, C', 'A, C', 'B', 'A, C', 'B', 'B, C', 'A, B', 'C', 'C']
      },
      simonSaysSequenceVowel = [
        { "Red": enumColors.BLUE, "Blue": enumColors.RED, "Green": enumColors.YELLOW, "Yellow": enumColors.GREEN },
        { "Red": enumColors.YELLOW, "Blue": enumColors.GREEN, "Green": enumColors.BLUE, "Yellow": enumColors.RED },
        { "Red": enumColors.GREEN, "Blue": enumColors.RED, "Green": enumColors.YELLOW, "Yellow": enumColors.BLUE },
      ],
      simonSaysSequenceNoVowel = [
        { "Red": enumColors.BLUE, "Blue": enumColors.YELLOW, "Green": enumColors.GREEN, "Yellow": enumColors.RED },
        { "Red": enumColors.YELLOW, "Blue": enumColors.BLUE, "Green": enumColors.YELLOW, "Yellow": enumColors.GREEN },
        { "Red": enumColors.YELLOW, "Blue": enumColors.GREEN, "Green": enumColors.BLUE, "Yellow": enumColors.RED },
      ];

  $scope.passwordPossibilities = passwordPool.join(", ");
  
  $scope.whosOnFirst = {step1: '', step2:''};
  $scope.whosOnFirstStep1Results = [];
  $scope.whosOnFirstStep2Results = [];
  
  // ===========================================================================
  //  Utility
  // ===========================================================================
  
  function getLevenshteinDistance(a, b){
    if (a.length === 0) return b.length; 
    if (b.length === 0) return a.length; 
  
    var matrix = [];
  
    // increment along the first column of each row
    var i;
    for(i = 0; i <= b.length; i++){
      matrix[i] = [i];
    }
  
    // increment each column in the first row
    var j;
    for(j = 0; j <= a.length; j++){
      matrix[0][j] = j;
    }
  
    // Fill in the rest of the matrix
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        if(b.charAt(i-1) == a.charAt(j-1)){
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                  Math.min(matrix[i][j-1] + 1, // insertion
                                           matrix[i-1][j] + 1)); // deletion
        }
      }
    }
  
    return matrix[b.length][a.length];
  }
  
  // ===========================================================================
  //  General
  // ===========================================================================

  $scope.$watch('numBatteries', function(newValue, oldValue) {
    $scope.updateButton();
    $scope.updateComplicatedWires();
  });
  $scope.$watch('serial.odd', function(newValue, oldValue) {
    updateWires();
    $scope.updateComplicatedWires();
  });
  $scope.$watch('seria.vowel', function(newValue, oldValue) {
    if (newValue !== oldValue) {
      $scope.resetSimonSays();
    }
  });
  $scope.$watch('indicator', function(newValue, oldValue) {
    $scope.updateButton();
  });
  $scope.$watch('componentfrk', function(newValue, oldValue) {
    $scope.updateButton();
  });
  $scope.$watch('componentcar', function(newValue, oldValue) {
    $scope.updateButton();
  });
  $scope.$watch('component.none', function(newValue, oldValue) {
    if (newValue === true) {
      $scope.component.parallel = false;
    }
  });
  $scope.$watch('component.parallel', function(newValue, oldValue) {
    if (newValue === true) {
      $scope.component.none = false;
    }
    $scope.updateComplicatedWires();
  });

  function serialIsOdd(undefinedCb) {
    if ($scope.serial === undefined || $scope.serial.odd === undefined) {
      if (undefinedCb !== undefined && undefinedCb !== null) {
        undefinedCb();
      }
      return undefined;
    }
    return $scope.serial.odd;
  }
  function serialIsEven(undefinedCb) {
    var isOdd = serialIsOdd(undefinedCb);
    return (isOdd === undefined) ? undefined : !isOdd;
  }
  
  function serialHasVowel() {
    if ($scope.serial === undefined || $scope.serial.vowel === undefined) {
      return undefined;
    }
    return $scope.serial.vowel;
  }
  
  function hasParallelPort(undefinedCb) {
    if ($scope.component === undefined || $scope.component.parallel === undefined) {
      if (undefinedCb !== undefined && undefinedCb !== null) {
        undefinedCb();
      }
      return undefined;
    }
    return $scope.component.parallel;
  }

  function getNumBatteries(undefinedCb ){
    if ($scope.numBatteries === undefined) {
      if (undefinedCb !== undefined && undefinedCb !== null) {
        undefinedCb();
      }
      return undefined;
    }
    return $scope.numBatteries;
  }

  // ===========================================================================
  //  Wires
  // ===========================================================================

  var updateWires = function() {
    var wires = $scope.selectedWires;
   
    function getWireCount(color) {
      return wires.filter(function(x) { return x == color; }).length;
    }
    
    function isOddUndefinedCB() {
      $scope.wireRequires = 'OddSerial';
    }
    
    $scope.wireRequires = 'Nothing';
    if (wires.length == 3) {
      if (getWireCount(enumColors.RED) === 0){
        $scope.cutWire = 2;
      } else if (wires[2] == enumColors.WHITE) {
        $scope.cutWire = 3;
      } else if (getWireCount(enumColors.BLUE) > 1) {
        $scope.cutWire = wires.lastIndexOf(enumColors.BLUE) + 1;
      } else {
        $scope.cutWire = 3;
      }
    } else if (wires.length == 4) {
      if (getWireCount(enumColors.RED) > 1 && serialIsOdd(isOddUndefinedCB)) {
         $scope.cutWire = wires.lastIndexOf(enumColors.RED) + 1;
      } else if (wires[3] == enumColors.YELLOW && getWireCount(enumColors.RED) === 0) {
         $scope.cutWire = 1;
      } else if(getWireCount(enumColors.BLUE) == 1) {
        $scope.cutWire = 1;
      } else if(getWireCount(enumColors.YELLOW) > 1) {
         $scope.cutWire = 4;
      } else{
         $scope.cutWire = 2;
      }
    } else if (wires.length == 5)  {
      if (wires[4] == enumColors.BLACK && serialIsOdd(isOddUndefinedCB)) {
         $scope.cutWire = 4;
      } else if (getWireCount(enumColors.RED) == 1 && getWireCount(enumColors.YELLOW) > 1) {
         $scope.cutWire = 1;
      } else if (getWireCount(enumColors.BLACK)===0) {
         $scope.cutWire = 2;
      } else {
         $scope.cutWire = 1;
      }
    } else if (wires.length ==  6)   {
      if (getWireCount(enumColors.YELLOW) === 0 && serialIsOdd(isOddUndefinedCB)) {
         $scope.cutWire = 3;
      } else if (getWireCount(enumColors.YELLOW) === 1 && getWireCount(enumColors.WHITE) > 1) {
         $scope.cutWire = 4;
      } else if (getWireCount(enumColors.RED) === 0) {
         $scope.cutWire = 6;
      } else {
         $scope.cutWire = 4;
      }
    }
  };

  $scope.addWire = function(colorString) {
    $scope.selectedWires.push(colorString);
    updateWires();
  };
  
  $scope.resetWires = function() {
    $scope.selectedWires = [];
    $scope.cutWire = undefined;
  };
  
  // ===========================================================================
  //  Wire Sequence
  // ===========================================================================
  
  var updateWireSeq = function() {
    function getColorCountInSeq(color) {
      var count = 0;
      for (var i = 0; i < $scope.wireSequence.length; ++i) {
        if ($scope.wireSequence[i] === color) {
          count += 1;
        } 
      }
      return count;
    }

    if ($scope.wireSequence.length <= 0) return;
    var lastColor = $scope.wireSequence[$scope.wireSequence.length - 1],
        colorCount = getColorCountInSeq(lastColor);
    if (colorCount > wireCutSequence[lastColor].length) {
      $scope.cutWireSeq = "<Error: Too many " + lastColor + " wires>";
    } else {
      $scope.cutWireSeq = wireCutSequence[lastColor][colorCount - 1];
    }
  };
  
  $scope.addWireToSeq = function(colorString) {
    $scope.wireSequence.push(colorString);
    updateWireSeq();
  };
  
  $scope.resetWireSeq = function() {
    $scope.wireSequence = [];
    $scope.cutWireSeq = undefined;
  };
  
  // ===========================================================================
  //  Buttons
  // ===========================================================================
  
  $scope.updateButton = function() {
  
    function undefBatteriesCb() {
      if ($scope.buttonRequires == 'Nothing') {
        $scope.buttonRequires = 'NumBatteries';
      }
    }

    var text = function() {
      if ($scope.button.text === undefined && $scope.buttonRequires == 'Nothing') {
          $scope.buttonRequires = "Text";
        return undefined;
      } else {
        return $scope.button.text;
      }
    },
    color = function() {

      if ($scope.button.color === undefined && $scope.buttonRequires == 'Nothing') {
          $scope.buttonRequires = "Color";
        return undefined;
      } else {
        return $scope.button.color;
      }
    },
    indicator = function(labelstring) {
      if (labelstring == 'frk') {
        if ($scope.componentfrk === undefined &&  $scope.buttonRequires == 'Nothing') {
           $scope.buttonRequires = "LabelFRK";
           return undefined;
        } else {
          return $scope.componentfrk;
        }
      } else if (labelstring == 'car') {
        if ($scope.componentcar === undefined &&  $scope.buttonRequires == 'Nothing') {
           $scope.buttonRequires = "LabelCAR";
           return undefined;
        } else {
          return $scope.componentcar;
        }
      }
    },
    hold = "hold",
    release  = "release";
    
    $scope.buttonRequires = 'Nothing';
    
    if (color() == enumColors.BLUE && text() == enumButtonText.ABORT) {
      $scope.buttonAction = hold;
    } else if (text() == enumButtonText.DETONATE && getNumBatteries(undefBatteriesCb) > 1) {
      $scope.buttonAction = release;
    } else if (color() == enumColors.WHITE && indicator('car') ) {
      $scope.buttonAction = hold;
    } else if (getNumBatteries(undefBatteriesCb) > 2 && indicator('frk')) {
      $scope.buttonAction = release;
    } else if (color() == enumColors.YELLOW) {
      $scope.buttonAction = hold;
    } else if (color() == enumColors.RED && text() == enumButtonText.HOLD) {
      $scope.buttonAction = release;
    } else {
      $scope.buttonAction = hold;
    }
  };
  
  $scope.resetButton = function() {
    $scope.button.color = undefined;
    $scope.button.text = undefined;
    $scope.buttonAction = undefined;
  };
  
  // ===========================================================================
  // Keypads
  // ===========================================================================
  
  var allIcons = [
    {src: "1-copyright.png", alt: "copyright", isSelected:false, isOpaque:false, columns:[3], rows:[1]},
    {src: "2-filledstar.png", alt: "sternschwarz", isSelected:false, isOpaque:false, columns:[5], rows:[7]},
    {src: "3-hollowstar.png", alt: "sternweiß", isSelected:false, isOpaque:false, columns:[2, 3], rows:[5,7]},
    {src: "4-smileyface.png", alt: "smiley", isSelected:false, isOpaque:false, columns:[4,5], rows:[7,2]},
    {src: "5-doublek.png", alt: "i", isSelected:false, isOpaque:false, columns:[3, 4], rows:[4,5 ]},
    {src: "6-omega.png", alt: "omega", isSelected:false, isOpaque:false, columns:[6], rows:[7]},
    {src: "7-squidknife.png", alt: "dreieck", isSelected:false, isOpaque:false, columns:[1, 4], rows:[5,4]},
    {src: "8-pumpkin.png", alt: "hodensack", isSelected:false, isOpaque:false, columns:[3], rows:[2]},
    {src: "9-hookn.png", alt: "H", isSelected:false, isOpaque:false, columns:[1, 2], rows:[6,6]},
    {src: "11-six.png", alt: "sigma", isSelected:false, isOpaque:false, columns:[4, 6], rows:[1, 1]},
    {src: "12-squigglyn.png", alt: "zickzack", isSelected:false, isOpaque:false, columns:[1], rows:[4]},
    {src: "13-at.png", alt: "A", isSelected:false, isOpaque:false, columns:[1], rows:[2]},
    {src: "14-ae.png", alt: "ae", isSelected:false, isOpaque:false, columns:[6], rows:[4]},
    {src: "15-meltedthree.png", alt: "halbe3", isSelected:false, isOpaque:false, columns:[3], rows:[5]},
    {src: "16-euro.png", alt: "euro", isSelected:false, isOpaque:false, columns:[2, 6], rows:[1, 2]},
    {src: "18-nwithhat.png", alt: "N", isSelected:false, isOpaque:false, columns:[6], rows:[6]},
    {src: "19-dragon.png", alt: "3", isSelected:false, isOpaque:false, columns:[5], rows:[6]},
    {src: "20-questionmark.png", alt: "fragezeichen", isSelected:false, isOpaque:false, columns:[2, 4], rows:[7, 6]},
    {src: "21-paragraph.png", alt: "paragraph", isSelected:false, isOpaque:false, columns:[4,5], rows:[2, 5]},
    {src: "22-rightc.png", alt: "C", isSelected:false, isOpaque:false, columns:[5], rows:[4]},
    {src: "23-leftc.png", alt: "C umgedreht", isSelected:false, isOpaque:false, columns:[1, 2], rows:[7,3]},
    {src: "24-pitchfork.png", alt: "kerzenständer", isSelected:false, isOpaque:false, columns:[5], rows:[1]},
    {src: "26-cursive.png", alt: "CQ", isSelected:false, isOpaque:false, columns:[2,3], rows:[4,3]},
    {src: "27-tracks.png", alt: "++", isSelected:false, isOpaque:false, columns:[6], rows:[3]},
    {src: "28-balloon.png", alt: "O", isSelected:false, isOpaque:false, columns:[1,2], rows:[1,2]},
    {src: "30-upsidedowny.png", alt: "lambda", isSelected:false, isOpaque:false, columns:[1,3], rows:[3,6]},
    {src: "31-bt.png", alt: "bt", isSelected:false, isOpaque:false, columns:[4,5],rows:[3,3]}
  ];
  
  $scope.keypads = allIcons.slice();
  
  $scope.selectedKeypads = [];
  
 function intersect_safe(a, b) {
  var ai = 0, bi = 0;
  var result = [];

  while (ai < a.length && bi < b.length) {
     if      (a[ai] < b[bi] ){ ai++; }
     else if (a[ai] > b[bi] ){ bi++; }
     else { /* they're equal */
       result.push(a[ai]);
       ai++;
       bi++;
     }
  }

  return result;
}

  $scope.resetKeypads = function() {
    $scope.keypads.forEach(function(e){
      e.isSelected = false;
      e.isOpaque = false;
    });
    $scope.resultKeypads = [];
    $scope.selectedKeypads = [];
  };

  $scope.clickKeypad = function(altText){
    var element = $scope.keypads.find(function(element){ return element.alt == altText;});
    
    if(!element.isSelected){
      element.isSelected = true;
      
      $scope.selectedKeypads.push(element);
      
      // find common column(s)
      var intersect = $scope.selectedKeypads[0].columns;
      $scope.selectedKeypads.forEach(function(ele){
        intersect = intersect_safe(intersect, ele.columns);
      });
      
      $scope.keypads.forEach(function(el){
        var hasCommonColumns = intersect_safe(el.columns, intersect).length > 0;
        if (!hasCommonColumns) {
          el.isOpaque = true;
        }
      });
      
      if ($scope.selectedKeypads.length == 4){
          $scope.resultKeypads = $scope.selectedKeypads.map(function(el){
            return {item: el, row:el.rows[el.columns.indexOf(intersect[0])]};
          }).sort(function(a,b){return a.row - b.row;}).map(function(el){
            return el.item;
          });
      }
    }
  };
  
  // ===========================================================================
  //  Simon Says
  // ===========================================================================
  
  $scope.resetSimonSays = function() {
    $scope.simonSaysSequence = [];
  };
  
  $scope.addSimonSays = function(color) {
    if (serialHasVowel() === undefined) return;
    var alphabet = serialHasVowel() ? simonSaysSequenceVowel : simonSaysSequenceNoVowel,
        nextColor = {"defuser": color, "expert": null};
    nextColor.expert = alphabet[$scope.numStrikes][color];
    $scope.simonSaysSequence.push(nextColor);
  };

  function refreshSimonSays()
  {
    if (serialHasVowel() === undefined) return;
    var alphabet = serialHasVowel() ? simonSaysSequenceVowel : simonSaysSequenceNoVowel;
    for (var i = 0; i < $scope.simonSaysSequence.length; ++i) {
      var color = $scope.simonSaysSequence[i].defuser;
      $scope.simonSaysSequence[i].expert = alphabet[$scope.numStrikes][color];
    }
  }
  $scope.$watch('numStrikes', function(newValue, oldValue) {
    if (newValue !== oldValue) {
      refreshSimonSays();
    }
  });
  
  // ===========================================================================
  //  Who's on first
  // ===========================================================================
  // word:  {y,x}
  var whosOnFirstDataS1 = [
    {word:"yes", y:1, x:0},
    {word:"first", y:0, x:1},
    {word:"display", y:2,x:1},
    {word:"okay", y:0,x:1},
    {word:"says", y:2,x:1},
    {word:"nothing", y:1,x:0, similarityGroup:0},
    {word:" ", y:2, x:0, similarityGroup:0},
    {word:"blank", y:1, x:1, similarityGroup:0},
    {word:"no",y:2, x:1},
    {word:"led", y:1, x:0, similarityGroup:1},
    {word:"lead", y:2, x:1, similarityGroup:1},
    {word:"read", y:1, x:1, similarityGroup:1},
    {word:"red", y:1 ,x:1, similarityGroup:1},
    {word:"reed", y:2,x:0, similarityGroup:1},
    {word:"leed", y:2 ,x:0, similarityGroup:1},
    {word:"hold on", y:2,x:1},
    {word:"you", y:1 ,x:1, similarityGroup:2},
    {word:"you are", y:2, x:1, similarityGroup:2},
    {word:"your", y:1 ,x:1, similarityGroup:2},
    {word:"you're", y:1 ,x:1, similarityGroup:2},
    {word:"ur", y:0 ,x:0, similarityGroup:2},
    {word:"there", y:2 ,x:1, similarityGroup:3},
    {word:"they're", y:2 ,x:0, similarityGroup:3},
    {word:"their", y:1 ,x:1, similarityGroup:3},
    {word:"they are", y:1 ,x:0, similarityGroup:3},
    {word:"see", y:2 ,x:1, similarityGroup:4},
    {word:"c", y:0 ,x:1, similarityGroup:4},
    {word:"cee", y:2 ,x:1, similarityGroup:4},
  ];
  var whosOnFirstDataS2 = [
    {word:"ready",result:["yes","okay","what","middle","left","press","right","blank","ready"]},
    {word:"first",result:["left","okay","yes","middle","no","right","nothing","uhhh","wait","ready","blank","what","press","first"]},
    {word:"no",result:["blank","uhhh","wait","first","what","ready","right","yes","nothing","left","press","okay","no"]},
    {word:"blank",result:["wait","right","okay","middle","blank"]},
    {word:"nothing",result:["uhhh","right","okay","middle","yes","blank","no","press","left","what","wait","first","nothing"]},
    {word:"yes",result:[" okay","right","uhhh","middle","first","what","press","ready","nothing","yes"]},
    {word:"what",result:["uhhh","what"], similarityGroup:3},
    {word:"uhhh",result:["ready","nothing","left","what","okay","yes","right","no","press","blank","uhhh"], similarityGroup:4},
    {word:"left",result:["right","left"]},
    {word:"right",result:["yes","nothing","ready","press","no","wait","what","right"]},
    {word:"middle",result:[" blank","ready","okay","what","nothing","press","no","wait","left","middle"]},
    {word:"okay",result:["middle","no","first","yes","uhhh","nothing","wait","okay"]},
    {word:"wait",result:["uhhh","no","blank","okay","yes","left","first","press","what","wait"]},
    {word:"press",result:["right","middle","yes","ready","press"]},
    {word:"you",result:[" sure","you are","your","you're","next","uh huh","ur","hold","what?","you"], similarityGroup:5},
    {word:"you are",result:["your","next","like","uh huh","what?","done","uh uh","hold","you","u","you're","sure","ur","you are"], similarityGroup:5},
    {word:"your",result:["uh uh","you are","uh huh","your"], similarityGroup:5},
    {word:"you're",result:[" you","you're"], similarityGroup:5},
    {word:"ur",result:["done","u","ur"], similarityGroup:5},
    {word:"u",result:["uh huh","sure","next","what?","you're","ur","uh uh","done","u"], similarityGroup:5},
    {word:"uh huh",result:["uh huh"], similarityGroup:4},
    {word:"uh uh",result:[ "ur","u","you are","you're","next","uh uh"], similarityGroup:4},
    {word:"what?",result:["you","hold","you're","your","u","done","uh uh","like","you are","uh huh","ur","next","what?"], similarityGroup:3},
    {word:"done",result:["sure","uh huh","next","what?","your","ur","you're","hold","like","you","u","you are","uh uh","done"]},
    {word:"next",result:["what?","uh huh","uh uh","your","hold","sure","next"]},
    {word:"hold",result:["you are","u","done","uh uh","you","ur","sure","what?","you're","next","hold"]},
    {word:"sure",result:["you are","done","like","you're","you","hold","uh huh","ur","sure"]},
    {word:"like",result:["you're","next","u","ur","hold","done","uh uh","what?","uh huh","you","like"]},
  ];
  
  $scope.updateWhosOnFirstStep1 = function() {
    var results = [],
        input = $scope.whosOnFirst.step1.toLowerCase();
    var usedSimGroups =[];
    // Pass 1 Fuzzy
    for (var wordData of whosOnFirstDataS1) {
      var dist = getLevenshteinDistance(wordData.word, input);
      var ind = wordData.word.indexOf(input);
      if (dist <= 2 || ind !== -1) { // matched
        if(wordData.similarityGroup !== undefined && usedSimGroups.indexOf(wordData.similarityGroup) == -1) {
          var similar = whosOnFirstDataS1
          .filter(function(kv){return kv.similarityGroup === wordData.similarityGroup;});
          
          similar.forEach(function(s){
             var dist2 = getLevenshteinDistance(s.word, input);
             var ind2 = s.word.indexOf(input);
             var resy = { dist: dist2 + (ind2 >= 0 ? ind2 * 4 : 10), "word": s.word, "x": s.x, "y": s.y };
             results.push(resy);
          });
          usedSimGroups.push(wordData.similarityGroup);
        } else if(wordData.similarityGroup === undefined){
          var res = { dist: dist + (ind >= 0 ? ind * 4 : 10), "word": wordData.word, "x": wordData.x, "y": wordData.y };
          results.push(res);
        }
      }
    }
    results.sort(function(a, b) { return a.dist - b.dist; });
    $scope.whosOnFirstStep1Results = results;
  };
  
  $scope.updateWhosOnFirstStep2 = function() {
    var results = [],
        input = $scope.whosOnFirst.step2.toLowerCase();
        var usedSimGroups =[];
        
    for (var wordData of whosOnFirstDataS2) {
      var dist = getLevenshteinDistance(wordData.word, input);
      var ind = wordData.word.indexOf(input);
      if (dist <= 2 || ind !== -1) {
        
         if(wordData.similarityGroup !== undefined && usedSimGroups.indexOf(wordData.similarityGroup) == -1){
          var similar =  whosOnFirstDataS2
          .filter(function(kv){return kv.similarityGroup === wordData.similarityGroup;});
          
          similar.forEach(function(s){
             var dist = getLevenshteinDistance(s.word, input);
             var ind = s.word.indexOf(input);
             var resy = { "dist": dist + (ind >= 0 ? ind * 4 : 10), "word": s.word, "results": s.result  };
             results.push(resy);
          });
          
          usedSimGroups.push(wordData.similarityGroup);
        } else if(wordData.similarityGroup === undefined){
          var res = { "dist": dist + (ind >= 0 ? ind * 4 : 10), "word": wordData.word, "results": wordData.result };
          results.push(res);
        }
        
        //var res = {"dist": dist+ (ind >= 0 ? ind * 4 : 10), "word": word, "results": whosOnFirstDataS2[word] };
        //results.push(res);
      }
    }
    results.sort(function(a, b) { return a.dist - b.dist; });
    $scope.whosOnFirstStep2Results = results;
  };
  
  $scope.resetWhosOnFirst = function() {
    $scope.whosOnFirst.step1 = '';
    $scope.whosOnFirst.step2 = '';
    $scope.whosOnFirstStep1Results = [];
    $scope.whosOnFirstStep2Results = [];
  };
  
  // ===========================================================================
  //  Mazes
  // ===========================================================================

  
  var tileFlags = Object.freeze({   "EMPTY": 0
                                  , "START": 1
                                  , "END":   2
                                  , "CIRCLE": 4
                                  , "WALL_TOP": 8
                                  , "WALL_RIGHT": 16
                                  , "WALL_BOTTOM": 32
                                  , "WALL_LEFT": 64 
                                  , "SOLUTION": 128});
  var mazes=[],
      emptyMaze=[];
  { // "flag-shorthand"-scope
    var e = tileFlags.EMPTY,
        c = tileFlags.CIRCLE,
        l = tileFlags.WALL_LEFT,
        r = tileFlags.WALL_RIGHT,
        t = tileFlags.WALL_TOP,
        b = tileFlags.WALL_BOTTOM;
    emptyMaze = [
          [e,e,e,e,e,e],
          [e,e,e,e,e,e],
          [e,e,e,e,e,e],
          [e,e,e,e,e,e],
          [e,e,e,e,e,e],
          [e,e,e,e,e,e]
     ];
  
     var maze1 = [
          [e,b,r,l,b,b],
          [r|c,l|t,r|b,l|b,t|b,t],
          [r,l|b,t|r,l|t,t|b,c],
          [r,l|t|b,b,b|r,l|t|b,e],
          [e,t|b,t|r,l|t,r|t|b,l],
          [e,r|t,l,r,l|t,e]
        ], // passt
     maze2 = [
          [b,e,b|r,l,e,b],
          [t,r|b,l|t,b|r,b|l|c,t],
          [r,t|l,b|r,l|t,t|b,e],
          [e,b|r|c,l|t,b|r,l|r|t,l],
          [r,l|t|r,l|r,l|t,b|r,l],
          [r,l,r,l,t,e] // passt
        ],
     maze3 = [
          [e, b,r,l|r,l,e],
          [b|r,l|t|r,l|r,l|b,b|r,l],
          [t, r,l|r,l|t,t|r,l],
          [r,l|r,l|r,l|r|c,l|r,l|c],
          [r,l|b,b|r,l|r,l|r,l],
          [e,t,t,r,l,e] // passt
        ],
     maze4 = [
          [c,r,l|b,b,b,e],
          [r,l|r,l|t,t|b,t|b,e],
          [r,l|b,r|b,t|l,t|r|b,l],
          [r|c,l|t|b,t|b,b,t|b,e],
          [e,t|b,t|b,t|b,t|r,l],
          [e,t,t|r,t|l,r,l],
        ], // passt
     maze5 =  [
          [b,b,b,b,e,e],  
          [t,t|b,t|b,t,b|r,l|b],
          [e,t|r,t|l|b,b|r,t|l|c,t],
          [r,l|b,t|b,t|r,l|b|r,l],
          [r,l|t,t|b,b,b|r|t,l],
          [r,l,t,t|c,t,e]
        ], // passt
     maze6 = [
          [r,l,r,l|b,c,e],
          [r,l|r,l|r,l|t,b|r,l],
          [e, b|r,l|b|r,l|r,l|t,b],
          [b,t|r,l|t,r,l|r,l|t],
          [t,b|r,l|b|r|c,l|r,b|l,e],
          [e,t,t,r,l|t,e]
        ], // passt
     maze7 = [
          [e,b|c,b,r,l,e],
          [r,l|t,t|r|b,l|b,b|r,l],
          [b,b|r,l|t,t|r|b,l|t,b],
          [t,t|r,l,t|b,b|r,l|t],
          [r,l|b|r,l|b,b|t,t|r,l],
          [e,t|c,t,t,e,e]
        ], // passt
     maze8 = [
          [r,l,b,c|r,l,e],
          [e,b,b|r|t,l|b,b|r,l],
          [r,l|t,t|b,t|b,t|r,l],
          [r,l|b,t|r|c,l|t|b,b,b],
          [r,l|t|r,l|b,t|b,t|b,t|b],
          [e,e,t,t,t,t] //passt
        ],
     maze9 = [
          [r,l,b,b,e,e],
          [r,l|r,l|t|c,t|r|b,l|r,l],
          [e,b,b|r,l|t,b|r,l],
          [r,l|t|r,l|t,b|r,l|b|t,e],
          [r|c,l|r,l|r,l|t,t|r,l|b],
          [e,r,l,r,l,t] // passt
        ];
  
      mazes = [maze1, maze2, maze3,
               maze4, maze5, maze6,
               maze7, maze8, maze9];
  }

  var mazeStateEnum = Object.freeze({   "SELECT_CIRCLE": 0
                                      , "SELECT_START": 1
                                      , "SELECT_END": 2 });

  function setMazeState(state) {
    if (state === mazeStateEnum.SELECT_CIRCLE) {
      $scope.mazeInstruction = 'Select circle position';
    } else if (state === mazeStateEnum.SELECT_START) {
      $scope.mazeInstruction = 'Select start position';
    } else if (state === mazeStateEnum.SELECT_END) {
      $scope.mazeInstruction = 'Select end position';
    } else {
      return; // invalid state
    }
    $scope.mazeState = state;
  }

  $scope.mazeClicked = function(posX, posY){
    
    if ($scope.mazeState === mazeStateEnum.SELECT_CIRCLE) {
      // set circle in current maze
      $scope.maze[posY][posX] = $scope.maze[posY][posX] | tileFlags.CIRCLE;
      
      // try to figure out maze
      var selectedMaze = mazes.filter(function (maze) {
        return maze[posY][posX] & tileFlags.CIRCLE; 
      })[0];
      
      if (selectedMaze !== undefined && selectedMaze !== null) {
        setMazeState(mazeStateEnum.SELECT_START);
        renderMaze(selectedMaze);
      }
      
      $scope.maze.circlePos = (posY+1) + " " + (posX + 1);
    } else if ($scope.mazeState == mazeStateEnum.SELECT_START) {
      // Reset start flags.
      for (var y = 0; y < $scope.maze.length; ++y) {
        for (var x = 0; x < $scope.maze[y].length; ++x) {
          $scope.maze[y][x] &= ~(tileFlags.START|tileFlags.SOLUTION); 
        }
      }
      $scope.maze[posY][posX] =  $scope.maze[posY][posX] | tileFlags.START;
      setMazeState(mazeStateEnum.SELECT_END);
      
      $scope.maze.startPos  = (posY+1) + " " + (posX + 1);
    } else if ($scope.mazeState == mazeStateEnum.SELECT_END) {
      // Reset end flags.
      for (var y = 0; y < $scope.maze.length; ++y) {
        for (var x = 0; x < $scope.maze[y].length; ++x) {
          $scope.maze[y][x] &= ~tileFlags.END; 
        }
      }
      
      $scope.maze[posY][posX] = $scope.maze[posY][posX] | tileFlags.END;
      
      $scope.maze.endPos  = (posY+1) + " " + (posX + 1);
      
      var path = backTrack($scope.maze);
      
      $scope.mazepath = path;
      if(path !== undefined && path !== false){
        for(var pI=1; pI<path.length-1;pI++){
          $scope.maze[path[pI].Y][path[pI].X] |= tileFlags.SOLUTION; 
        }
      }
      setMazeState(mazeStateEnum.SELECT_START);
    }
  }
  
  $scope.getMazeCellClasses = function(flags) {
    var classes = [];
    if (flags & tileFlags.WALL_TOP)    { classes.push('maze-wall-top'); }
    if (flags & tileFlags.WALL_RIGHT)  { classes.push('maze-wall-right'); }
    if (flags & tileFlags.WALL_BOTTOM) { classes.push('maze-wall-bottom'); }
    if (flags & tileFlags.WALL_LEFT)   { classes.push('maze-wall-left'); }
    if (flags & tileFlags.CIRCLE)   { classes.push('maze-cell-circle'); }
    if (flags & tileFlags.START)    { classes.push('maze-cell-start'); }
    if (flags & tileFlags.END)      { classes.push('maze-cell-end'); }
    if (flags & tileFlags.SOLUTION) { classes.push('maze-cell-solution'); }
    return classes.join(' ');
  };
  
  function renderMaze(maze) {
    // Deep copy of maze
    $scope.maze = maze.map(function(r){
      return r.map(function(x){return x;});
    });
  }
  
  function backTrack(maze){
    var startPos, endPos;
     for (var y = 0; y < $scope.maze.length; ++y) {
        for (var x = 0; x < $scope.maze[y].length; ++x) {
          if($scope.maze[y][x] & tileFlags.END)
            endPos = {X: x, Y: y, Direction:'TARGET'};
          if($scope.maze[y][x] & tileFlags.START)
            startPos = {X: x, Y: y,Direction:'START'};
        }
      }
      if(startPos === undefined || endPos === undefined)
        return;
      return backTrackImpl(maze, startPos, endPos,[]);
    
  }

  function backTrackImpl(maze, pos, endPos, visitedPath) {
    var walkableCells =[];
    if (!(maze[pos.Y][pos.X] & tileFlags.WALL_TOP) && pos.Y > 0) {
      walkableCells.push({X: pos.X, Y: pos.Y-1, Direction:'UP'});
    }
    if (!(maze[pos.Y][pos.X] & tileFlags.WALL_RIGHT) && pos.X < 5) {
      walkableCells.push({X: pos.X+1, Y: pos.Y, Direction:'RIGHT'});
    }
    if (!(maze[pos.Y][pos.X] & tileFlags.WALL_LEFT) && pos.X > 0) {
      walkableCells.push({X: pos.X-1, Y: pos.Y, Direction:'LEFT'});
    }
    if (!(maze[pos.Y][pos.X] & tileFlags.WALL_BOTTOM) && pos.Y < 5) {
      walkableCells.push({X: pos.X, Y: pos.Y+1, Direction:'DOWN'});
    }
    
    for(var i = 0; i < walkableCells.length; i++){
      // only walk if its not the last cell, maze is always circle free, so no need to check for more
      if (visitedPath.length == 0
          || (visitedPath.length > 0
              && (walkableCells[i].X !== visitedPath[visitedPath.length - 1].X
                  || walkableCells[i].Y !== visitedPath[visitedPath.length - 1].Y))) {
        if (walkableCells[i].Y === endPos.Y && walkableCells[i].X === endPos.X) { // found! return path
          visitedPath.push(pos);
          visitedPath.push(walkableCells[i]);
          return visitedPath;
        } else { // recurse
         visitedPath.push(pos);
          var res = backTrackImpl(maze, walkableCells[i], endPos, visitedPath); 
          if (res !== false) {
            return res;
          } else {
            visitedPath.pop();
          }
        }
      }
    }
    // no walkable option found, this must be a dead end
    return false;
  }

  $scope.resetMaze = function() {
    renderMaze(emptyMaze);
    $scope.mazepath = undefined;
    setMazeState(mazeStateEnum.SELECT_CIRCLE);
  };
  $scope.resetMaze();

  // ===========================================================================
  //  Memory
  // ===========================================================================

  $scope.memoryStages = [{index: 1, display:undefined,position: undefined, label:undefined}];
  $scope.updateMemory = function() {
    var definedStages = $scope.memoryStages.filter(function(s) { return s.display !== undefined; }).map(function (s) { return s.index; }),
    
    
        stageIndex = definedStages[definedStages.length-1],
        stage, display;
    
    function pushNewStage(stageIndex) {
      $scope.memoryStages.push({ index: stageIndex, display: undefined, position: undefined, label: undefined });
    }
    
    switch (stageIndex) {
    case 1:
      stage = $scope.memoryStages[0];
      if (stage.display !== undefined) {
        display = parseInt(stage.display);
        switch (display) {
          case 1:
          case 2:
            stage.position = 2;
            break;
          case 3:
            stage.position = 3;
            break;
          case 4:
            stage.position = 4;
            break;
        }
        if ($scope.memoryStages.length == 1) {
          pushNewStage(2);
        }
      }
      break;
    case 2:
      stage = $scope.memoryStages[1];
      if (stage.display !== undefined) {
        display = parseInt(stage.display);
        switch (display) {
        case 1:
          stage.label = 4;
          break;
        case 2:
        case 4:
          stage.position = $scope.memoryStages[0].position;
          break;
        case 3:
          stage.position = 1;
          break;
        }
        if ($scope.memoryStages.length == 2) {
          pushNewStage(3);
        }
      }
      break;
    case 3:
      stage = $scope.memoryStages[2];
      if (stage.display !== undefined) {
        display = parseInt(stage.display);
        switch (display) {
        case 1:
          stage.label = $scope.memoryStages[1].label;
          break;
        case 2:
          stage.label = $scope.memoryStages[0].label;
          break;
        case 3:
          stage.position = 3;
          break;
        case 4:
          stage.label = 4;
          break;
        }
        if ($scope.memoryStages.length == 3) {
          pushNewStage(4);
        }
      }
      break;
    case 4:
      stage = $scope.memoryStages[3];
      if (stage.display !== undefined) {
        display = parseInt(stage.display);
        switch (display) {
        case 1:
          stage.position = $scope.memoryStages[0].position;
          break;
        case 2:
          stage.position = 1;
          break;
        case 3:
        case 4:
          stage.position = $scope.memoryStages[1].position;
          break;
        }
        if ($scope.memoryStages.length == 4) {
          pushNewStage(5);
        }
      }
      break;
    case 5:
      stage = $scope.memoryStages[4];
      if (stage.display !== undefined) {
        display = parseInt(stage.display);
        switch (display) {
        case 1:
          stage.label = $scope.memoryStages[0].label;
          break;
        case 2:
          stage.label = $scope.memoryStages[1].label;
          break;
        case 3:
          stage.label = $scope.memoryStages[3].label;
          break;
        case 4:
          stage.label = $scope.memoryStages[2].label;
          break;
        } 
      }
      break;
    }
  };

 $scope.resetMemory = function() {
    $scope.memoryStages =$scope.memoryStages = [{index: 1, display:undefined,position: undefined, label:undefined}];
  };
  $scope.resetMemory();
  
  // ===========================================================================
  //  Complicated Wires
  // ===========================================================================

  function calcComplicatedWire(red, blue, white, star, led) {
    var cwire = {
      'red': red,
      'blue': blue,
      'white': white,
      'star': star,
      'led': led,
      'cut': "?",
      'needBatteries': false,
      'needParallelPort': false,
      'needSerial': false
    },
    doCut = "Cut!",
    dontCut = "Don't Cut";
    if (   ( red && !blue && !star && !led)
        || (!red &&  blue && !star && !led) 
        || ( red &&  blue && !star && !led)
        || ( red &&  blue && !star&&   led)) {
      var evenSerial = serialIsEven();
      if (evenSerial === undefined) {
        cwire.needSerial = true;
      } else {
        cwire.cut = (evenSerial) ? doCut : dontCut;
      }
    } else if (   (!red && !blue && !star && !led)
               || (!red && !blue &&  star && !led)
               || ( red && !blue &&  star && !led)) {
      cwire.cut = doCut;
    } else if (   (!red &&  blue &&  star && !led)
               || (red && blue && star && led)
               || (!red && !blue && !star &&  led)) {
      cwire.cut = dontCut;
    } else if (   ( red &&  blue &&  star && !led)
               || (!red &&  blue && !star &&  led)
               || (!red &&  blue &&  star &&  led)) {
      var parallelPort = hasParallelPort();
      if (parallelPort === undefined) {
        cwire.needParallelPort = true;
      } else {
        cwire.cut = parallelPort ? doCut : dontCut;
      }
    } else if (   ( red && !blue && !star &&  led)
               || (!red && !blue &&  star &&  led)
               || ( red && !blue &&  star &&  led)) {
      var batteryCount = getNumBatteries();
      if (batteryCount === undefined) {
        cwire.needBatteries = true;
      } else {
        cwire.cut = batteryCount >= 2 ? doCut : dontCut;
      }
    }
    return cwire;
  }
  
  $scope.updateComplicatedWires = function() {
    for (var i = 0; i < $scope.complicatedWires.length; ++i) {
      var cwire = $scope.complicatedWires[i];
      cwire = calcComplicatedWire(cwire.red, cwire.blue, cwire.white, cwire.star, cwire.led);
      $scope.complicatedWires[i] = cwire;
    }
  };

  $scope.addComplicatedWire = function() {
    function getCompWire(which) {
      return which !== undefined && which === true;
    }
    var cwire = calcComplicatedWire(
      getCompWire($scope.complicatedWire.nextRed),
      getCompWire($scope.complicatedWire.nextBlue),
      getCompWire($scope.complicatedWire.nextWhite),
      getCompWire($scope.complicatedWire.nextStar),
      getCompWire($scope.complicatedWire.nextLED)
    );
    $scope.complicatedWire.nextRed =
    $scope.complicatedWire.nextBlue =
    $scope.complicatedWire.nextWhite =
    $scope.complicatedWire.nextStar =
    $scope.complicatedWire.nextLED = false;

    $scope.complicatedWires.push(cwire);
  };
  

  $scope.resetComplicatedWires = function() {
    $scope.complicatedWires = [];
  };
  
  // ===========================================================================
  //  Passwords
  // ===========================================================================
  $scope.resetPasswords = function(){
    $scope.passwordParts.part1="";
    $scope.passwordParts.part2="";
    $scope.passwordParts.part3="";
    $scope.passwordParts.part4="";
    $scope.passwordParts.part5="";
    $scope.getPasswords();
  };

  $scope.getPasswords = function() {
    function partToReg(value) {
      return (value !== undefined && value !== "") ? '[' + value.toLowerCase() + value.toUpperCase() + ']' : "[a-z]{0,5}";
    }
    var pw = [   partToReg($scope.passwordParts.part1)
               , partToReg($scope.passwordParts.part2)
               , partToReg($scope.passwordParts.part3)
               , partToReg($scope.passwordParts.part4)
               , partToReg($scope.passwordParts.part5) ],
        pwReg = new RegExp('^('+pw[0]+')('+pw[1]+')('+pw[2]+')('+pw[3]+')?('+pw[4]+')$','i'),
        res = [];
    for (var i = 0; i < passwordPool.length; ++i) {
      if (passwordPool[i].match(pwReg)) {
        res.push(passwordPool[i]);
      }
    }
    $scope.passwordPossibilities = res.join(", ");
  };
  // ===========================================================================
  //  Knobs
  // ===========================================================================
$scope.knob ={};
$scope.knob.ledrows = [[false, false, false, false, false, false],
[false, false, false, false, false, false]].map(function(r){
  return r.map(function(r2){return {IsClicked:r2};});
});

var knobs = [];
{
  // shorthand notation
  var x = true;
  var _ = false;
   knobs = [{Direction: 'UP', Configuration:[[_,_,x,_,x,x],[x,x,x,x,_,x]]},
  {Direction: 'UP', Configuration:[[x,_,x,_,x,_],[_,x,x,_,x,x]]},
  {Direction: 'DOWN', Configuration:[[_,x,x,_,_,x],[x,x,x,x,_,x]]},
  {Direction: 'DOWN', Configuration:[[x,_,x,_,x,_],[_,x,_,_,_,x]]},
  {Direction: 'LEFT', Configuration:[[_,_,_,_,x,_],[x,_,_,x,x,x]]},
  {Direction: 'LEFT', Configuration:[[_,_,_,_,x,_],[_,_,_,x,x,_]]},
  {Direction: 'RIGHT', Configuration:[[x,_,x,x,x,x],[x,x,x,_,x,_]]},
  {Direction: 'RIGHT', Configuration:[[x,_,x,x,_,_],[x,x,x,_,x,_]]}];
}
$scope.knob.clickKnob = function(){
   var lastClicked = 0;
   for(var j = 0; j < 2; j++){
      for(var i = 0; i < 6; i++){
        if($scope.knob.ledrows[j][i].IsClicked){
          lastClicked = j*6+i;
        }
      }
    }
 var matchedKnobs = knobs.filter(function(k){
    var match = true;
    for(var j = 0; j < 2; j++){
      for(var i = 0; i < 6 && (j*6+i <= lastClicked); i++){
        if(k.Configuration[j][i] !== $scope.knob.ledrows[j][i].IsClicked){
          match = false;
        }
      }
    }
    return match;
  });
  if(matchedKnobs.length==1){
    $scope.knob.result = matchedKnobs[0].Direction;
  }
  else if(matchedKnobs.length>1){
    $scope.knob.result = "ambiguous, fill out more";
  }
  else{
    $scope.knob.result = "no match found";
  }
};
$scope.knob.resetKnob = function()  {
  $scope.knob.ledrows = [
    [false, false, false, false, false, false],
    [false, false, false, false, false, false]].map(function(r){
  return r.map(function(r2){return {IsClicked:r2};});
  
});
  $scope.knob.result=undefined;
};
$scope.knob.result = "?";
  // ===========================================================================
  //  Morse
  // ===========================================================================

  $scope.morseCodeReset = function() {
    $scope.morse.code = "";
    $scope.morseResult = undefined;
    $scope.orderedFrequencies = undefined;
  };
 

  $scope.convertMorse = function() {
    var morseFrequencies = [
        ['shell',  '3.505', '... .... . .-.. .-..'], 
        ['halls',  '3.515', '.... .- .-.. .-.. ...'],
        ['slick',  '3.522', '... .-.. .. -.-. -.-'], 
        ['trick',  '3.532', ' - .-. .. -.-. -.-'],
        ['boxes',  '3.535',  '-... --- -..- . ...'], 
        ['leaks',  '3.542', '.-.. . .- -.- ...'], 
        ['strobe', '3.545', '... - .-. --- -... .'], 
        ['bistro', '3.552', '-... .. ... - .-. ---'],
        ['flick',  '3.555', '..-. .-.. .. -.-. -.-'],
        ['bombs',  '3.565', '-... --- -- -... ...'],
        ['break',  '3.572', '-... .-. . .- -.-'], 
        ['brick',  '3.575', '-... .-. .. -.-. -.-'],
        ['steak',  '3.582', '... - . .- -.-'], 
        ['sting',  '3.592', '... - .. -. --.'], 
        ['vector', '3.595', '...- . -.-. - --- .-.'], 
        ['beats',  '3.600', '-... . .- - ...']
      ]
    , convertMap = {
        '.-': 'a', '-...': 'b', '-.-.': 'c', '-..': 'd', '.': 'e', '..-.': 'f',
        '--.': 'g', '....': 'h', '..': 'i', '.---': 'j', '-.-': 'k', '.-..': 'l',
        '--': 'm', '-.': 'n', '---': 'o', '.--.': 'p', '--.-': 'q', '.-.': 'r',
        '...': 's', '-': 't', '..-': 'u', '...-': 'v', '.--': 'w', '-..-': 'x',
        '-.--': 'y', '--..': 'z', '.----': '1', '..---': '2', '...--': '3',
        '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8',
        '----.': '9', '-----': '0'
      }
    , morseCode = $scope.morse.code.split(" ")
    , morseResult = "";

    for (var i = 0; i < morseCode.length; ++i) {
      var code = convertMap[morseCode[i]];
      morseResult += (code === undefined) ? '?' : code;
    }
    
    $scope.orderedFrequencies = morseFrequencies.map(function(m){
      return { mF: m,
               dist: getLevenshteinDistance(m[0], morseResult),
               dist2:getLevenshteinDistance(m[2], $scope.morse.code),
               morse: m[2] };
    }).sort(function(a,b) { return a.dist2-b.dist2; });
    
    var mDist  = $scope.orderedFrequencies.sort(function(a,b) { return a.dist-b.dist; })[0].dist,
        mDist2 = $scope.orderedFrequencies.sort(function(a,b) { return a.dist2-b.dist2; })[0].dist2;
    
    $scope.orderedFrequencies.forEach(function(e){
      if (e.dist == mDist)
        e.ismindist = true;
      if (e.dist2 == mDist2 )
        e.ismindist2 = true;
    });

    $scope.morseResult = morseResult;
  };

}]);



keepTalkingApp.filter('range', function() {
  return function(input, total) {
    total = parseInt(total);
    for (var i=0; i<total; i++) {
      input.push(i);
    }
    return input;
  };
});

jQuery(document).ready(function($) {
  $('.show-hide').click(function() {
    var what = $(this).data("what");
    $(what).toggle();
    return false;
  });
});


