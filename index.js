/*
  Constants - these will get inlined by the minifier but make it a lot more
  readable
*/
/*
  These are indices into tiles
*/
var X = 0
var Y = 1
var TILE_TYPE = 2
var HP = 3
var CHAR = 4
var SEEN = 5
/*
  Tile types
*/
var TILE_TYPE_PLAYER = 0
var TILE_TYPE_MONSTER = 1
var TILE_TYPE_STAIRS_DOWN = 2
var TILE_TYPE_FLOOR = 3
var TILE_TYPE_POTION = 4
var TILE_TYPE_WALL = 5
/*
  Indices into level structure
*/
var FLOORS = 0
var MOBS = 1
/*
  Symbols
*/
var CHAR_PLAYER = '@'
var CHAR_WALL = '#'
var CHAR_FLOOR = '.'
var CHAR_MONSTER = 'm'
var CHAR_STAIRS_DOWN = '>'
var CHAR_STAIRS_UP = '<'
var CHAR_POTION = '¢'
var CHAR_WIN = '$'

/*
  Dungeon settings

  width and height are the bounds for randomly placing initial points for 
  rooms, but aside from placing those initial points, no bounding checks are 
  done, to save bytes - the draw algorithm and movement checks are designed 
  around points being potentially at any coordinate including negative ones

  minRoomSize and maxRoomSize are the min/max in each direction from the 
  "center" of a room and not the total min/max size for a room
*/  
var width = 10
var height = 10
var minRoomSize = 1
var maxRoomSize = 5
var roomCount = 2
var monsterCount = 2
var playerStartHP = 10

var debug = false

if( debug ){
  playerStartHP = 1000
}

/*
  Bog-standard exlusive max based random integer function
*/
var randInt = exclusiveMax => ( Math.random() * exclusiveMax ) | 0
    
/*
  View settings
*/
var viewSize = 25
var viewOff = 12 // ( viewSize - 1 ) / 2
var fov = 8

/*
  Level state
*/
var currentLevel = 0
var level
var player = [ 
  randInt( width ), randInt( height ), 
  TILE_TYPE_PLAYER, playerStartHP, CHAR_PLAYER
]

/*
  Is there a tile in collection that collides with the provided point?
  
  Also check the hit points and don't consider "dead" tiles for collision
  
  This lets us kill monsters without deleting them from the array, which is
  expensive - we just don't collide with or draw dead things

  Has strange side effect whereby floors etc need HP in order to be drawn haha

  Same as points.find( ... ) but reuse for(;;) syntax for better packing
*/
var collides = ( tiles, point ) => {
  for( var i = 0; i < tiles.length; i++ ){
    if( 
      tiles[ i ][ HP ] && 
      point[ X ] == tiles[ i ][ X ] && 
      point[ Y ] == tiles[ i ][ Y ] 
    ) return tiles[ i ]
  }
}

var towardsOrDirection = ( p1, p2, direction, towards ) => {
  if( towards ){
    if( p1[ X ] < p2[ X ] ){
      p2[ X ]--
    } 
    else if( p1[ X ] > p2[ X ] ){
      p2[ X ]++
    } 
    else if( p1[ Y ] < p2[ Y ] ){
      p2[ Y ]--        
    } 
    else if( p1[ Y ] > p2[ Y ] ){
      p2[ Y ]++
    }
  } else {
    //up
    if( direction == 1 ){
      p2[ Y ]--
    } 
    //right
    else if( direction == 2 ){
      p2[ X ]++
    } 
    //down
    else if( direction == 3 ){
      p2[ Y ]++
    } 
    //left
    else{
      p2[ X ]--
    }
  }    
}

/*
  Dungeon generator
*/
var Dungeon = () => {    
  var floors = [
    [ player[ X ], player[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR ]
  ]
  var mobs = [ player ]

  var levelWidth = randInt( currentLevel * width ) + width
  var levelHeight = randInt( currentLevel * height ) + height
  var levelRooms = randInt( currentLevel * roomCount ) + roomCount
  var levelMonsters = randInt( currentLevel * monsterCount ) + monsterCount
  var levelPotions = randInt( currentLevel * monsterCount ) + monsterCount

  /*
    Add a new mob, even stairs are mobs to save bytes
  */
  var addMob = ( tileType, hp, ch ) => {
    var mob = [ 
      randInt( levelWidth ), randInt( levelHeight ), 
      tileType, hp, ch 
    ]
    
    /*
      Has to collide with a floor tile to be on map, but also has to be the
      only mob at this point on the map
    */
    if( 
      collides( level[ FLOORS ], mob ) && 
      !collides( level[ MOBS ], mob ) 
    ){
      level[ MOBS ].push( mob )

      return mob
    } 
    
    /*
      Call recursively if couldn't place, saves a while loop
    */
    return addMob( tileType, hp, ch )    
  }
  
  // draw an L-shaped corridor between these two points
  var connect = ( p1, p2 ) => {     
    if( !collides( floors, p2 ) ){
      floors.push(
        [ p2[ X ], p2[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR ]
      )
    }

    if( p1[ X ] == p2[ X ] && p1[ Y ] == p2[ Y ] ) return

    var direction = randInt( 4 )

    towardsOrDirection( p1, p2, direction, !randInt( 3 ) )

    connect( p1, p2 )
  } 

  for( var i = 0; i < levelRooms; i++ ){
    connect( 
      floors[ randInt( floors.length ) ], 
      [ randInt( levelWidth ), randInt( levelHeight ) ] 
    )
  }
  
  level = [ floors, mobs ]

  // would be nice to not have stairs in corridors
  addMob( TILE_TYPE_STAIRS_DOWN, 1, currentLevel > 8 ? CHAR_WIN : CHAR_STAIRS_DOWN )

  for( var i = 0; i < levelMonsters; i++ ){
    addMob( TILE_TYPE_MONSTER, 1, CHAR_MONSTER )
  }

  for( var i = 0; i < levelPotions; i++ ){
    addMob( TILE_TYPE_POTION, 1, CHAR_POTION )
  }
} 

/*
  Almost like a raycaster, we create a viewport centered on the player and
  use the collision algorithm to decide whether to draw or not for each tile, 
  gets rid of tedious bounds checking etc - super inefficient for the CPU but 
  good for byte count of code
*/
var draw = () => {
  /*
    canvas default is 10pt text
  */
  var textSize = 10

  /*
    cheapest way to clear canvas?
  */
  a.width = a.width

  for( var vY = 0; vY < viewSize; vY++ ){
    for( var vX = 0; vX < viewSize; vX++ ){
      var x = player[ X ] - viewOff + vX
      var y = player[ Y ] - viewOff + vY

      var current = 
        collides( level[ MOBS ], [ x, y ] ) || 
        collides( level[ FLOORS ], [ x, y ] )

      if( !current ){
        level[ MOBS ].push( 
          [ x, y, TILE_TYPE_WALL, 1, CHAR_WALL ] 
        )
        current = collides( level[ MOBS ], [ x, y ] )
      }          

      if( 
        vX >= fov && vY >= fov && 
        vX < ( viewSize - fov ) && vY < ( viewSize - fov ) 
      ){
        current[ SEEN ] = 1
      }

      c.fillText( 
        currentLevel > 9 ?
        CHAR_WIN :
        player[ HP ] < 1 ?
        0 :
        current[ SEEN ] ? 
        current[ CHAR ] : 
        ' ', 
        vX * textSize, 
        vY * textSize 
      )
    }
  }

  if( player[ HP ] > 0 && currentLevel < 11 )
    c.fillText( 
      ( currentLevel + 1 ) + ' ¢' + player[ HP ], 0, viewSize * textSize 
    )
}

/*
  Movement for both payers and monsters
*/
var move = ( mob, direction ) => {    
  /*
    initial position
  */
  var currentPosition = [ mob[ X ], mob[ Y ] ]

  /*
    Monsters, one in five chance doesn't move towards player, otherwise try to
    move closer - the move algorithm  creates very predictable movement but is 
    also very cheap - the chance not to move towards player helps to stop 
    monsters getting permanently stuck
  */
  towardsOrDirection( 
    player, currentPosition, 
    direction, mob[ TILE_TYPE ] == TILE_TYPE_MONSTER && randInt( 5 ) 
  )

  /*
    See if anything is at the point we tried to move to
  */
  var currentTile = collides( level[ MOBS ], currentPosition )

  /*
    If we're a monster and the tile we tried to move to has a player on it,
    try to hit them instead of moving there
  */
  if( 
    currentTile && mob[ TILE_TYPE ] == TILE_TYPE_MONSTER && 
    currentTile[ TILE_TYPE ] == TILE_TYPE_PLAYER && randInt( 2 ) 
  ){
    currentTile[ HP ]--
  } 
  /*
    Ditto for player moving onto monster
  */
  else if( 
    currentTile && mob[ TILE_TYPE ] == TILE_TYPE_PLAYER && 
    currentTile[ TILE_TYPE ] == TILE_TYPE_MONSTER && randInt( 2 ) 
  ){
    currentTile[ HP ]--
  }
  /*
    Go down stairs
  */
  else if( 
    currentTile && mob[ TILE_TYPE ] == TILE_TYPE_PLAYER &&
    currentTile[ TILE_TYPE ] == TILE_TYPE_STAIRS_DOWN 
  ){
    currentLevel++
    Dungeon()
  }
  /*
    Potion - note that monsters can also pick up potions - to change, check
    if mob is player
  */
  else if( currentTile && currentTile[ TILE_TYPE ] == TILE_TYPE_POTION ){
    mob[ HP ]++
    currentTile[ HP ]--
  }
  /*
    If this is a floor tile and no mobs were here, we can move
  */
  else if( 
    collides( level[ FLOORS ], currentPosition ) && !currentTile 
  ){
    mob[ X ] = currentPosition[ X ]
    mob[ Y ] = currentPosition[ Y ]
  } 
}

b.onkeydown = e => {
  /*
    Player moves first, slight advantage
  */
  move( player, e.which - 37 )
  
  /*
    Search the mobs for monsters, try to randomly move any that aren't dead
    Monsters prefer to move towards player but there's a chance they'll use
    this passed in random "keycode" instead
  */
  for( var i = 0; i < level[ MOBS ].length; i++ ){
    if( 
      level[ MOBS ][ i ][ HP ] && 
      level[ MOBS ][ i ][ TILE_TYPE ] == TILE_TYPE_MONSTER 
    ) move( level[ MOBS ][ i ], randInt( 4 ) )
  }

  draw()
  /*
  consider adding chance to spawn a monster on movement
  */
}

Dungeon()
draw()    
