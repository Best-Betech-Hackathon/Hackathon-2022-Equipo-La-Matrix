importScripts('lib/tank.js');

//VARS
// strategy function that is currently used
var strategy;
// random direction of the tank that results in vertical movement (north or south)
var verticalAngle;
// random direction of the tank that results in horizontal movement (east or west)
var horizontalAngle;
// best direction to shoot when the tank is hidden i battlefield's corner
var shootAngle;
// timer used to change shooting angle over the time
var timer = 0;
var turnDirection, turnTimer, direction, backTimer, boostTimer;
var avoidDirection;
var bulletMap;
var caseControl=1;

function goToDirection(targetAngle, state, control, done) {
  var angleDelta = Math.deg.normalize(targetAngle - state.angle);
  control.TURN = angleDelta * 0.2;
  // use boost to hide in corner ASAP
//  control.BOOST = 1;

  // if any enemy on the radar - shoot!
  if(state.radar.enemy) {
    control.SHOOT = 1;
  } else {
    control.SHOOT = 0;
  }

  if(Math.abs(angleDelta) < 5) {
    // do not move forward if a tank is on your way
    if(state.collisions.enemy || state.collisions.ally) {
      control.THROTTLE = 0;
    } else {
      control.THROTTLE = 1;
    }
    // finish movement when close to a wall
    if(state.radar.wallDistance && state.radar.wallDistance < 50) {
      control.THROTTLE = 0;
      control.TURN = 0;
      control.BOOST = 0;
      done();
    }
  }
}
// strategy of moving north/south
// used at the beginning to go close to a wall
function goVerticalStrategy(state, control) {
  goToDirection(verticalAngle, state, control, function() {
    // when done - go to a corner
    strategy = goHorizontalStrategy;
  });
  control.DEBUG.strategy = "goVerticalStrategy:" + verticalAngle;
}
function goHorizontalStrategy(state, control) {
  goToDirection(horizontalAngle, state, control, function() {
    // when done - start shooting
    strategy = shootStrategy;
  });
  control.DEBUG.strategy = "goHorizontalStrategy:" + horizontalAngle;
}
function shootStrategy(state, control) {
  // 20*Math.sin(timer*0.1) cause rotation +-20 degrees over the time
  var angleDelta = Math.deg.normalize(shootAngle + 20*Math.sin(timer*0.1) - state.angle);
  control.TURN = angleDelta * 0.3;
  control.SHOOT = 0.1;
  control.DEBUG.strategy = "shootStrategy:" + shootAngle;
}
function changeAvoidDirection() {
  avoidDirection = Math.random() > 0.5 ? -1 : 1;
}
function initChickenMode(){
     verticalAngle = Math.random() < 0.5 ? -90 : +90;
  horizontalAngle = Math.random() < 0.5 ? 0 : -180;
  // find direction that is opposite to the corner where the tank is
  shootAngle = Math.deg.normalize(verticalAngle + horizontalAngle)/2;
  if(horizontalAngle == 0) {
    shootAngle += 180;
  }
  // start from moving north/south
  strategy = goVerticalStrategy;
}
function performChicken(state, control){
  strategy(state, control);
  timer++;
}
function initKamiKaze(){
   turnDirection = Math.random() < 0.5 ? 1 : -1;
  turnTimer = Math.round(Math.randomRange(0, 30));
  direction = 1;
  backTimer = 0;
}
function performKamikaze(state, control){

  if(state.collisions.enemy || state.collisions.ally) {
    backTimer = 12;
    boostTimer = 40;
  }
  if(backTimer > 0) {
    backTimer--;
    direction = -1;
  } else {
    direction = 1;
  }
  if(boostTimer > 0) {
    boostTimer--;
    control.BOOST = 1;
  } else {
   // control.BOOST = 0;
  }
  control.THROTTLE = direction;
  if(!state.radar.enemy) {
    control.RADAR_TURN = 1;
    if(state.collisions.wall) {
      turnTimer = Math.round(Math.randomRange(20, 50));
    }
    if(turnTimer > 0) {
      turnTimer--;
      control.THROTTLE = 0;
      control.TURN = turnDirection;
    } else {
      control.THROTTLE = direction;
      control.TURN = 0;
    }
  } else {
    // find target angle to aim the enemy
    var targetAngle = Math.deg.atan2(
      state.radar.enemy.y - state.y,
      state.radar.enemy.x - state.x
    );
    // make sure that the angle is between (-180 and 180)
    var radarAngleDelta = Math.deg.normalize(targetAngle - (state.radar.angle + state.angle));
    // adjust radar direction to follow the target
    control.RADAR_TURN = radarAngleDelta*0.2;
    // make sure that the angle is between (-180 and 180)
    var tankAngleDelta = Math.deg.normalize(targetAngle - state.angle);
    // adjust radar direction to follow the target
    control.TURN = tankAngleDelta * 0.2;
  }
  control.SHOOT = state.radar.enemy ? 0.3 : 0;
}
function initDodge(state, control){
  bulletMap = [];
  changeAvoidDirection();
}
function performDodge(state, control){
 var i, bullet, bodyAngleDelta;

  // Rotate radar around to find an enemy.
  // When enemy found, keep radar beam on him
  if(state.radar.enemy) {
    // calculate angle of the enemy relating to your tank
    // this is the angle that you should aim your radar and gun to
    var enemyAngle = Math.deg.atan2(
      state.radar.enemy.y - state.y,
      state.radar.enemy.x - state.x
    )
    // calculate the difference between current and desired angle
    // of the radar.
    var radarAngleDelta = Math.deg.normalize(enemyAngle - (state.radar.angle + state.angle));
    // Turn the radar. If the difference between current and desired
    // angle is getting smaller, speed of turning will get lower too.
    // When the difference will be zero, turning will stop.
    control.RADAR_TURN = radarAngleDelta * 0.2;

    // Turn body of the tank so it is perpendicular to the enemyAngle
    // it will be easier to dodge bullets by moving back and forth
    bodyAngleDelta = Math.deg.normalize(enemyAngle - 90 - state.angle);
    if(Math.abs(bodyAngleDelta) > 90) bodyAngleDelta += 180;
    control.TURN = bodyAngleDelta * 0.2;

    // aim your gun at the enemy
    var gunAngleDelta = Math.deg.normalize(enemyAngle - (state.gun.angle + state.angle));
    control.GUN_TURN = gunAngleDelta*0.2;

    // shoot if you have aimed at the enemy
    control.SHOOT = 0.1;

  } else {
    // keep searching for opponents
    control.TURN = 0;
    control.RADAR_TURN = 1;
    bodyAngleDelta = 180;
  }

  // find bullets using radar
  for(i in state.radar.bullets) {
    bullet = state.radar.bullets[i];
    bullet.age = 0;
    bulletMap[bullet.id] = bullet;

    // calculate velocity components and distance between bullet and the tank
    bullet.vx = bullet.speed * Math.cos(bullet.angle*(Math.PI/180));
    bullet.vy = bullet.speed * Math.sin(bullet.angle*(Math.PI/180));
    bullet.tankDistance = Math.distance(state.x, state.y, bullet.x, bullet.y);
  }

  var bulletCount = 0;
  // predict position of all bullets scanned so far
  for(i in bulletMap) {
    bullet = bulletMap[i];
    if(!bullet) continue;
    // skip bullets that was not updated for long time
    // if they were not spotted by radar recently, they
    // probably are too far or hit something
    if(bullet.age > 50) {
      bulletMap[i] = null;
      continue;
    }
    // track age of the bullet so they can be removed if out-dated
    bullet.age++;
    // predict position of the bullet basing on its velocity
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    // calculate distance between bullet and the tank. It will be used to
    // find how fast the distance is changing
    var newDistance = Math.distance(state.x, state.y, bullet.x, bullet.y);
    bullet.approachingSpeed = bullet.tankDistance - newDistance;
    bullet.tankDistance = newDistance;

    // If distance between tank and the bullet is negative, it means that it
    // is moving away from the tank and can be ignored (if will not hit it)
    //
    // In addition, if the speed of approaching the tank is too low, it means
    // that the trajectory of the bullet is away of the tank and it will
    // not hit it. Such bullets can be ignored too. The threshold value set
    // experimentally to 3.85
    if(bullet.approachingSpeed < 3.85) {
      bulletMap[i] = null;
      continue;
    }
    // count how many bullets are really dangerous and will probably hit the tank
    bulletCount++;
  }

  // avoid bullets when any of them is aiming at you and
  // you are rotated in a way that you can dodge it
  if(bulletCount && Math.abs(bodyAngleDelta) < 45) {
    control.BOOST = 1;
    control.THROTTLE = avoidDirection;
  } else {
    control.BOOST = 0;
    control.THROTTLE = 0;
    // change direction of bullets dodging
    changeAvoidDirection();
  }
}
// -------------------------------------------------------------------------------------------
tank.init(function(settings, info) {
 initChickenMode();
 initKamiKaze();
 initDodge();
});



tank.loop(function(state, control) {
 if(caseControl ==  0 && state.energy < 95)
   caseControl =1;
  if(caseControl == 1 && (state.energy <50 || state.collisions.wall))
    caseControl =2;
  switch(caseControl){
    case 0:
			performChicken(state, control);
      break;
    case 2:
      performKamikaze(state, control); 
      break;
    case 1:
      performDodge(state, control);
      break;
  }
});
