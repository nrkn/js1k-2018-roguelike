/*
  Constants - these will get inlined by the minifier but make it a lot more
  readable
*/
/*
  These are indices into tile structures, where the structure is an array
  It's cheaper and packs better if every complex structure is an array
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
  waypoints, but aside from placing those initial points, no bounding checks are 
  done, to save bytes - the draw algorithm and movement checks are designed 
  around points being potentially at any coordinate including negative ones
*/  
let width = 10
let height = 10
let roomCount = 2
let monsterCount = 2
let playerStartHP = 10
  
/*
  View settings
*/
let viewSize = 25
let viewOff = 12 // ( viewSize - 1 ) / 2
let fov = 8

/*
  Game state
*/
let currentLevel = 0
let level
let player = [ 
  0, 0, TILE_TYPE_PLAYER, playerStartHP, CHAR_PLAYER, COLOR_PLAYER
]

/*
  Bog-standard exlusive max random integer function
*/
let randInt = exclusiveMax => ( Math.random() * exclusiveMax ) | 0

/*
  Is there a tile in collection that collides with the provided point?
  
  Also check the hit points and don't consider "dead" tiles for collision
  
  This lets us kill monsters, pick up potions etc without deleting them from the 
  array, which is expensive - we just don't collide with or draw dead things

  Has strange side effect whereby floors etc need HP in order to be drawn haha
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

/*
  Move p2 - mutates this point rather than returns a new one, cheaper

  If towards is truthy it moves towards p1

  Otherwise, it moves according to the direction passed
*/
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
    /*
      This order is chosen to match the order of the key codes for arrow keys
    */
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
  Level generator
*/
let NewLevel = () => {    
  level = [
    // floor tiles - always have a floor tile for the player
    [
      [ player[ X ], player[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR, COLOR_FLOOR ]
    ],
    // mobs - start with just player
    [ player ]
  ]

  /* 
    Cave more likely to be larger and have more monsters etc as you move down
    the levels
  */
  let levelWidth = randInt( currentLevel * width ) + width
  let levelHeight = randInt( currentLevel * height ) + height
  let levelRooms = randInt( currentLevel * roomCount ) + roomCount
  let levelMonsters = randInt( currentLevel * monsterCount ) + monsterCount
  let levelPotions = randInt( currentLevel * monsterCount ) + monsterCount

  /*
    Add a new mob, even stairs are mobs to save bytes
  */
  let addMob = ( tileType, hp, ch, color ) => {
    // new mob at random location
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
  
  /*
    Modified drunkard's walk algorithm to tunnel out a cave between p1 and p2
  */ 
  let connect = ( p1, p2 ) => {     
    /*
      Always place p2 if it doesn't exist
    */
    if( !collides( level[ FLOORS ], p2 ) ){
      level[ FLOORS ].push(
        [ p2[ X ], p2[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR, COLOR_FLOOR ]
      )
    }

    /*
      If we reached the goal, stop
    */
    if( p1[ X ] == p2[ X ] && p1[ Y ] == p2[ Y ] ) return

    /*
      Pick a random direction to move in
    */
    let direction = randInt( 4 )

    /* 
      Either move in that random direction, or 1 in 4 chance it moves towards
      goal - better to have it move randomly most of the time, or you just end 
      up with a series of connected L shaped corridors
    */
    towardsOrDirection( p1, p2, direction, !randInt( 3 ) )

    /*
      Call again, this will keep happening until we reach the goal
    */
    connect( p1, p2 )
  } 

  /*
    Tunnel out several chambers in the cave, between a random point and a
    randomly selected existing point
  */
  for( let i = 0; i < levelRooms; i++ ){
    connect( 
      level[ FLOORS ][ randInt( level[ FLOORS ].length ) ], 
      [ randInt( levelWidth ), randInt( levelHeight ) ] 
    )
  }

  /*
    Would be ideal to not have stairs block corridors as it can make some parts
    of the map unreachable, but that's exprensive and the levels are at least 
    always finishable
  */
  addMob( 
    TILE_TYPE_STAIRS_DOWN, 
    1, 
    currentLevel > 8 ? CHAR_WIN : CHAR_STAIRS_DOWN, 
    currentLevel > 8 ? COLOR_WIN : COLOR_STAIRS_DOWN 
  )

  /*
    Place monsters at random free floor locations
  */
  for( let i = 0; i < levelMonsters; i++ ){
    addMob( TILE_TYPE_MONSTER, 1, CHAR_MONSTER, COLOR_MONSTER )
  }

  /*
    Place healing potions (coins) at random free floor locations
  */
  for( let i = 0; i < levelPotions; i++ ){
    addMob( TILE_TYPE_POTION, 1, CHAR_POTION, COLOR_POTION )
  }
} 

/*
  Almost like a raycaster, we create a viewport centered on the player and
  use the collision algorithm to decide what to draw for each tile we hit, 
  gets rid of tedious bounds checking etc - good for byte count of code but 
  super inefficient for the CPU. If you have a large viewport and large level 
  it's very slow, even on a modern machine, but runs OK with the settings we're 
  using
*/
let draw = () => {
  /*
    canvas default is 10pt text
  */
  let textSize = 10

  /*
    Cheapest way to clear canvas?
  */
  a.width=a.width

  /*
    Iterate over tiles in viewport
  */
  for( let vY = 0; vY < viewSize; vY++ ){
    for( let vX = 0; vX < viewSize; vX++ ){
      /*
        Normalize the viewport coordinates to map coordinates, centered on the
        player
      */
      let x = player[ X ] - viewOff + vX
      let y = player[ Y ] - viewOff + vY

      /*
        See if we have first a mob, and if not, then a floor here
      */
      let current = 
        collides( level[ MOBS ], [ x, y ] ) || 
        collides( level[ FLOORS ], [ x, y ] )

      /*
        If nothing, add a wall at this location, then assign it to current
      */
      if( !current ){
        level[ MOBS ].push( 
          [ x, y, TILE_TYPE_WALL, 1, CHAR_WALL, COLOR_WALL ] 
        )
        current = collides( level[ MOBS ], [ x, y ] )
      }          

      /*
        Add the seen flag to all tiles within the field of view
      */
      if( 
        vX >= fov && vY >= fov && 
        vX < ( viewSize - fov ) && vY < ( viewSize - fov ) 
      ){
        current[ SEEN ] = 1
      }

      /*
        If the player is dead or has won, use the WIN condition color to draw
        the tile, otherwise use the tile color

        -nb can optimize by inverting and using same tests as below?        
      */
      c.fillStyle = player[ HP ] > 0 && currentLevel < 10 ? current[ COLOR ] : COLOR_WIN

      /*
        If the player has won, draw $, so the screen will fill up with $
        If dead, fill it with zero symbol, it's cheap to draw and gets the point 
        across
        Otherwise, if the tile has been seen, draw the character associated with
        it, or a space if unseen
      */
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

  /*
    Draw status bar if hasn't won or died, showing current level and HP (coins) 
    left
  */
  if( player[ HP ] > 0 && currentLevel < 10 ){
    c.fillStyle = '#000'
    c.fillText( 
      1 + currentLevel + ' ¢' + player[ HP ], 0, viewSize * textSize
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
    monsters getting permanently stuck and makes it feel less mechanical
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
    try to hit them instead of moving there (50% chance)
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
    Player moved on to stairs, create a new level
  */
  else if( 
    currentTile && mob[ TILE_TYPE ] == TILE_TYPE_PLAYER &&
    currentTile[ TILE_TYPE ] == TILE_TYPE_STAIRS_DOWN 
  ){
    currentLevel++
    NewLevel()
  }
  /*
    Potion - note that monsters can also pick up potions - to change, check
    if mob is player, but this is more fun for game play as it creates some
    monsters that are stronger as the monsters traverse the level and get 
    potions, also situations where the player is trying not to let the monster
    get it etc
  */
  else if( currentTile && currentTile[ TILE_TYPE ] == TILE_TYPE_POTION ){
    mob[ HP ]++
    currentTile[ HP ]--
  }
  /*
    Finally, if nothing else happened and this is a floor tile, we can move the
    mob onto it
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
    this passed in random direction instead
  */
  for( let i = 0; i < level[ MOBS ].length; i++ ){
    if( 
      level[ MOBS ][ i ][ HP ] && 
      level[ MOBS ][ i ][ TILE_TYPE ] == TILE_TYPE_MONSTER 
    ) move( level[ MOBS ][ i ], randInt( 4 ) )
  }

  /*
    Redraw on movement
  */
  draw()
}

/*
  Generate first level, draw initial view
*/
NewLevel()
draw()
