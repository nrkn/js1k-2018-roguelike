/*
  Constants - these will get inlined by the minifier but make it a lot more
  readable
*/
/*
  These are indices into tiles
*/
let X = 0
let Y = 1
let TILE_TYPE = 2
let HP = 3
let CHAR = 4
let COLOR = 5
let SEEN = 6
/*
  Tile types
*/
let TILE_TYPE_PLAYER = 0
let TILE_TYPE_MONSTER = 1
let TILE_TYPE_STAIRS_DOWN = 2
let TILE_TYPE_FLOOR = 3
let TILE_TYPE_POTION = 4
let TILE_TYPE_WALL = 5
/*
  Indices into level structure
*/
let FLOORS = 0
let MOBS = 1
/*
  Symbols
*/
let CHAR_PLAYER = '@'
let CHAR_WALL = '#'
let CHAR_FLOOR = '.'
let CHAR_MONSTER = 'm'
let CHAR_STAIRS_DOWN = '>'
let CHAR_POTION = '¢'
let CHAR_WIN = '$'
/*
  Colors
*/
let COLOR_PLAYER = '#000'
let COLOR_WALL = '#aaa'
let COLOR_FLOOR = '#aaa'
let COLOR_MONSTER = '#000'
let COLOR_STAIRS_DOWN = '#000'
let COLOR_POTION = '#f90'
let COLOR_WIN = '#f90'

/*
  Dungeon settings

  width and height are the bounds for randomly placing initial points for 
  rooms, but aside from placing those initial points, no bounding checks are 
  done, to save bytes - the draw algorithm and movement checks are designed 
  around points being potentially at any coordinate including negative ones

  minRoomSize and maxRoomSize are the min/max in each direction from the 
  "center" of a room and not the total min/max size for a room
*/  
let width = 10
let height = 10
let minRoomSize = 1
let maxRoomSize = 5
let roomCount = 2
let monsterCount = 2
let playerStartHP = 10

/*
  Bog-standard exlusive max based random integer function
*/
let randInt = exclusiveMax => ( Math.random() * exclusiveMax ) | 0
    
/*
  View settings
*/
let viewSize = 25
let viewOff = 12 // ( viewSize - 1 ) / 2
let fov = 8

/*
  Level state
*/
let currentLevel = 0
let level
let player = [ 
  randInt( width ), randInt( height ), 
  TILE_TYPE_PLAYER, playerStartHP, CHAR_PLAYER, COLOR_PLAYER
]

/*
  Is there a tile in collection that collides with the provided point?
  
  Also check the hit points and don't consider "dead" tiles for collision
  
  This lets us kill monsters without deleting them from the array, which is
  expensive - we just don't collide with or draw dead things

  Has strange side effect whereby floors etc need HP in order to be drawn haha

  Same as points.find( ... ) but reuse for(;;) syntax for better packing
*/
let collides = ( tiles, point ) => {
  for( let i = 0; i < tiles.length; i++ ){
    if( 
      tiles[ i ][ HP ] && 
      point[ X ] == tiles[ i ][ X ] && 
      point[ Y ] == tiles[ i ][ Y ] 
    ) return tiles[ i ]
  }
}

let towardsOrDirection = ( p1, p2, direction, towards ) => {
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
let Dungeon = () => {    

  level = [
    [
      [ player[ X ], player[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR, COLOR_FLOOR ]
    ],
    [ player ]
  ]

  let levelWidth = randInt( currentLevel * width ) + width
  let levelHeight = randInt( currentLevel * height ) + height
  let levelRooms = randInt( currentLevel * roomCount ) + roomCount
  let levelMonsters = randInt( currentLevel * monsterCount ) + monsterCount
  let levelPotions = randInt( currentLevel * monsterCount ) + monsterCount

  /*
    Add a new mob, even stairs are mobs to save bytes
  */
  let addMob = ( tileType, hp, ch, color ) => {
    let mob = [ 
      randInt( levelWidth ), randInt( levelHeight ), 
      tileType, hp, ch, color
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
    return addMob( tileType, hp, ch, color )    
  }
  
  // draw an L-shaped corridor between these two points
  let connect = ( p1, p2 ) => {     
    if( !collides( level[ FLOORS ], p2 ) ){
      level[ FLOORS ].push(
        [ p2[ X ], p2[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR, COLOR_FLOOR ]
      )
    }

    if( p1[ X ] == p2[ X ] && p1[ Y ] == p2[ Y ] ) return

    let direction = randInt( 4 )

    towardsOrDirection( p1, p2, direction, !randInt( 3 ) )

    connect( p1, p2 )
  } 

  for( let i = 0; i < levelRooms; i++ ){
    connect( 
      level[ FLOORS ][ randInt( level[ FLOORS ].length ) ], 
      [ randInt( levelWidth ), randInt( levelHeight ) ] 
    )
  }
  
  

  // would be nice to not have stairs block corridors
  addMob( 
    TILE_TYPE_STAIRS_DOWN, 
    1, 
    currentLevel > 8 ? CHAR_WIN : CHAR_STAIRS_DOWN, 
    currentLevel > 8 ? COLOR_WIN : COLOR_STAIRS_DOWN 
  )

  for( let i = 0; i < levelMonsters; i++ ){
    addMob( TILE_TYPE_MONSTER, 1, CHAR_MONSTER, COLOR_MONSTER )
  }

  for( let i = 0; i < levelPotions; i++ ){
    addMob( TILE_TYPE_POTION, 1, CHAR_POTION, COLOR_POTION )
  }
} 

/*
  Almost like a raycaster, we create a viewport centered on the player and
  use the collision algorithm to decide whether to draw or not for each tile, 
  gets rid of tedious bounds checking etc - super inefficient for the CPU but 
  good for byte count of code
*/
let draw = () => {
  /*
    canvas default is 10pt text
  */
  let textSize = 10

  a.width=a.width

  for( let vY = 0; vY < viewSize; vY++ ){
    for( let vX = 0; vX < viewSize; vX++ ){
      let x = player[ X ] - viewOff + vX
      let y = player[ Y ] - viewOff + vY

      let current = 
        collides( level[ MOBS ], [ x, y ] ) || 
        collides( level[ FLOORS ], [ x, y ] )

      if( !current ){
        level[ MOBS ].push( 
          [ x, y, TILE_TYPE_WALL, 1, CHAR_WALL, COLOR_WALL ] 
        )
        current = collides( level[ MOBS ], [ x, y ] )
      }          

      if( 
        vX >= fov && vY >= fov && 
        vX < ( viewSize - fov ) && vY < ( viewSize - fov ) 
      ){
        current[ SEEN ] = 1
      }

      c.fillStyle = player[ HP ] > 0 && currentLevel < 10 ? current[ COLOR ] : COLOR_WIN

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

  if( player[ HP ] > 0 && currentLevel < 10 ){
    c.fillStyle = '#000'
    c.fillText( 
      currentLevel + ' ¢' + player[ HP ], 0, viewSize * textSize
    )
  }
}

/*
  Movement for both payers and monsters
*/
let move = ( mob, direction ) => {    
  /*
    initial position
  */
  let currentPosition = [ mob[ X ], mob[ Y ] ]

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
  let currentTile = collides( level[ MOBS ], currentPosition )

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
  for( let i = 0; i < level[ MOBS ].length; i++ ){
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