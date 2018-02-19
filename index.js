'use strict'

/*
  This function closure is just for the minifier so it knows it's OK to rename
  variables - can remove before packing
*/
let G = () => {
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
  let SEEN = 5
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
  let CHAR_STAIRS_UP = '<'
  let CHAR_POTION = '!'
  
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

  let debug = false

  if( debug ){
    playerStartHP = 1000
  }

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
  let levels = []
  let player = [ 
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
    /*
      Allow moving up stairs
    */
    // if( levels[ currentLevel ] ) return
   
    let floors = [
      [ player[ X ], player[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR ]
    ]
    let mobs = [ player ]

    let levelWidth = randInt( currentLevel * width ) + width
    let levelHeight = randInt( currentLevel * height ) + height
    let levelRooms = randInt( currentLevel * roomCount ) + roomCount
    let levelMonsters = randInt( currentLevel * monsterCount ) + monsterCount
    let levelPotions = randInt( currentLevel * monsterCount ) + monsterCount

    /*
      Add a new mob, even stairs are mobs to save bytes
    */
    let addMob = ( tileType, hp, ch ) => {
      let mob = [ 
        randInt( levelWidth ), randInt( levelHeight ), 
        tileType, hp, ch 
      ]
      
      /*
        Has to collide with a floor tile to be on map, but also has to be the
        only mob at this point on the map
      */
      if( 
        collides( levels[ currentLevel ][ FLOORS ], mob ) && 
        !collides( levels[ currentLevel ][ MOBS ], mob ) 
      ){
        levels[ currentLevel ][ MOBS ].push( mob )

        return mob
      } 
      
      /*
        Call recursively if couldn't place, saves a while loop
      */
      return addMob( tileType, hp, ch )    
    }
    
    // draw an L-shaped corridor between these two points
    let connect = ( p1, p2 ) => {     
      if( !collides( floors, p2 ) ){
        floors.push(
          [ p2[ X ], p2[ Y ], TILE_TYPE_FLOOR, 1, CHAR_FLOOR ]
        )
      }

      if( p1[ X ] == p2[ X ] && p1[ Y ] == p2[ Y ] ) return

      let direction = randInt( 4 )

      towardsOrDirection( p1, p2, direction, !randInt( 3 ) )

      connect( p1, p2 )
    } 
  
    for( let i = 0; i < levelRooms; i++ ){
      connect( floors[ randInt( floors.length ) ], [ randInt( levelWidth ), randInt( levelHeight ) ] )
    }
    
    levels[ currentLevel ] = [ floors, mobs ]

    // would be nice to not have stairs in corridors
    addMob( TILE_TYPE_STAIRS_DOWN, 1, CHAR_STAIRS_DOWN )

    for( let i = 0; i < levelMonsters; i++ ){
      addMob( TILE_TYPE_MONSTER, 1, CHAR_MONSTER )
    }

    for( let i = 0; i < levelPotions; i++ ){
      addMob( TILE_TYPE_POTION, 1, CHAR_POTION )
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

    /*
      cheapest way to clear canvas?
    */
    a.width = a.width

    for( let vY = 0; vY < viewSize; vY++ ){
      for( let vX = 0; vX < viewSize; vX++ ){
        let x = player[ X ] - viewOff + vX
        let y = player[ Y ] - viewOff + vY

        let current = 
          collides( levels[ currentLevel ][ MOBS ], [ x, y ] ) || 
          collides( levels[ currentLevel ][ FLOORS ], [ x, y ] )

        if( !current ){
          levels[ currentLevel ][ MOBS ].push( [ x, y, TILE_TYPE_WALL, 1, CHAR_WALL ] )
          current = collides( levels[ currentLevel ][ MOBS ], [ x, y ] )
        }          

        if( vX >= fov && vY >= fov && vX < ( viewSize - fov ) && vY < ( viewSize - fov ) ){
          current[ SEEN ] = 1
        }
  
        c.fillText( 
          currentLevel > 9 ?
          '*' :
          player[ HP ] < 1 ?
          'X' :
          current[ SEEN ] ? 
          current[ CHAR ] : 
          ' ', 
          vX * textSize, 
          vY * textSize 
        )
      }
    }
    c.fillText( 'L ' + currentLevel + ' HP ' + player[ HP ], 0, viewSize * textSize )
  }

  /*
    Movement for both payers and monsters
  */
  let move = ( mob, direction ) => {    
    /*
      set the position we're going to move to to the position we're already at
    */
    let targetPoint = [ mob[ X ], mob[ Y ] ]

    /*
      Monsters, one in five chance doesn't move towards player, otherwise try to
      move closer - the if/else structure here creates very predictable movement
      but is also very cheap - the chance not to move towards player helps to
      stop monsters getting permanently stuck
    */

    towardsOrDirection( player, targetPoint, direction, mob[ TILE_TYPE ] == TILE_TYPE_MONSTER && randInt( 5 ) )

    /*
      See if anything is at the point we tried to move to
    */
    let currentTile = collides( levels[ currentLevel ][ MOBS ], targetPoint )

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
      collides( levels[ currentLevel ][ FLOORS ], targetPoint ) && !currentTile 
    ){
      mob[ X ] = targetPoint[ X ]
      mob[ Y ] = targetPoint[ Y ]
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
    for( let i = 0; i < levels[ currentLevel ][ MOBS ].length; i++ ){
      if( 
        levels[ currentLevel ][ MOBS ][ i ][ HP ] && 
        levels[ currentLevel ][ MOBS ][ i ][ TILE_TYPE ] == TILE_TYPE_MONSTER 
      ) move( levels[ currentLevel ][ MOBS ][ i ], randInt( 4 ) )
    }

    draw()
    /*
    consider adding chance to spawn a monster on movement
    */
  }

  Dungeon()
  draw()    
}

G()