importScripts('lib/tank.js');

// timer of tank turns. Whenever the tank hits a wall, the timer
// will be set to a positive integer. Within each simulation step
// the timer will be decreased by one eventually hitting zero.
// The tank will keep turning as long as turnTime is above zero.
// In that way, turning will be sustained for several steps of
// the simulation
var turnTime;
  
// SHOOT ENEMY ---------------------------------------------------------------------------------
function shootEnemy(state, control) {
  let enemy = state.radar.enemy;
  if(!enemy) {
    return;
  }

  // predict position of moving target
  let bulletSpeed = 4;
  let distance = Math.distance(state.x, state.y, enemy.x, enemy.y)
  let bulletTime = distance / bulletSpeed;
  let targetX = enemy.x + bulletTime * enemy.speed * Math.cos(Math.deg2rad(enemy.angle));
  let targetY = enemy.y + bulletTime * enemy.speed * Math.sin(Math.deg2rad(enemy.angle));

  // calculate desired direction of the gun
  let targetAngle = Math.deg.atan2(targetY - state.y, targetX - state.x);
  let gunAngle = Math.deg.normalize(targetAngle - state.angle);

  // point the gun at the target9
  let angleDiff = Math.deg.normalize(gunAngle - state.gun.angle);
  control.GUN_TURN = 0.3 * angleDiff;

  //variate shoot force
  if (distance>=150)
    bulletPower=1;
  if(distance <150 || distance >=50)
    bulletPower=0.3;
  if(distance <50)
    bulletPower =0.1;

  // shoot when aiming at target
  if(Math.abs(angleDiff) < 1) {
    control.SHOOT = 1;
  }
}

// SCAN ENEMY ---------------------------------------------------------------------------------
function scanEnemy(state, control) {
  if(!state.radar.enemy) {
    // scan around for the enemy
    control.RADAR_TURN = 1;
    return
  }
  
  //keep the enemy in the middle of radar beam
  let targetAngle = Math.deg.atan2(state.radar.enemy.y - state.y, state.radar.enemy.x - state.x);
  let radarAngle = Math.deg.normalize(targetAngle - state.angle);
  let angleDiff = Math.deg.normalize(radarAngle - state.radar.angle);
  control.RADAR_TURN = angleDiff;

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
}

// FOLLOW ENEMY ---------------------------------------------------------------------------------
function followEnemy(state, control) {
  if(!state.radar.enemy) {
    return;
  }

  let targetAngle = Math.deg.atan2(state.radar.enemy.y - state.y, state.radar.enemy.x - state.x);
  let bodyAngleDiff = Math.deg.normalize(targetAngle - state.angle);
  control.TURN = 0.5 * bodyAngleDiff;

  let targetDistance = Math.distance(state.x, state.y, state.radar.enemy.x, state.radar.enemy.y);
  let distanceDiff = targetDistance - 150;
  control.THROTTLE = distanceDiff/100;
}

// EXPLORE THE BATTLEFIELD ---------------------------------------------------------------------------------
function exploreBattlefiield(state, control) {
  if(state.radar.enemy) {
    control.THROTTLE = 0;
    return;
  }

  if(state.collisions.wall || turnTime > 0 || state.radar.enemy) {
    control.THROTTLE = 0;
  } else {
    control.THROTTLE = 1;
  }

  if(state.collisions.wall) {
    // start turning when hitting a wall
    turnTime = 50;
  }

  // keep turning whenever turn timer is above zero
  // reduce the timer with each step of the simulation
  if(turnTime > 0) {
    control.TURN = 1;
    turnTime--;
  } else {
    control.TURN = 0;
  }
}
// -------------------------------------------------------------------------------------------
tank.init(function(settings, info) {
  // do not turn at the beginning
  turnTime = 0;

  settings.SKIN = 'lava';
  bulletMap = [];
});

tank.loop(function(state, control) {
  shootEnemy(state, control);
  scanEnemy(state, control);
  followEnemy(state, control);
  exploreBattlefiield(state, control);
});