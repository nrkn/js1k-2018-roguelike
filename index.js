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
    These are indices into "point" structures - so-called, because they also
    hold the type, HP, character to draw etc.
  */
  let X = 0
  let Y = 1
  let POINT_TYPE = 2
  let HP = 3
  let CHAR = 4
  /*
    Point types, pseudo-enum
  */
  let POINT_TYPE_PLAYER = 0
  let POINT_TYPE_MONSTER = 1
  let POINT_TYPE_STAIRS = 2
  let POINT_TYPE_FLOOR = 3
  /*
    Indices into level structure
  */
  let LEVEL_FLOORS = 0
  let LEVEL_MOBS = 1
  /*
    Symbols
  */
  let CHAR_PLAYER = '@'
  let CHAR_WALL = '#'
  let CHAR_FLOOR = '.'
  let CHAR_MONSTER = 'm'
  let CHAR_STAIRS_DOWN = '>'
  let CHAR_STAIRS_UP = '<'
  let CHAR_HEAL = '!'
  
  /*
    Dungeon settings

    width and height are the bounds for randomly placing initial points for 
    rooms, but aside from placing those initial points, no bounding checks are 
    done, to save bytes - the draw algorithm and movement checks are designed 
    around points being potentially at any coordinate including negative ones

    minSize and maxSize are the min/max in each direction from the "center" of
    a room (the randomly chosen point for that room), and not the total min/max 
    for a room
  */  
  let width = 100
  let height = 100
  let minSize = 1
  let maxSize = 15
  let roomCount = 10
  let monsterCount = 10
  let playerStartHP = 10

  /*
    Bog-standard exlusive max based random integer function
  */
  let randInt = exclMax => ( Math.random() * exclMax ) | 0
      
  /*
    View settings
  */
  let viewSize = 25
  let viewOff = 12

  /*
    Level state
  */
  let currentLevel = 0
  let levels = []
  let player = [ 
    randInt( width ), randInt( height ), 
    POINT_TYPE_PLAYER, playerStartHP, CHAR_PLAYER
  ]
  
  /*
    Is there a point in collection that collides with the provided point?
    
    Also check the hit points and don't consider "dead" points to collide
    
    This lets us kill monsters without deleting them from the array, which is
    expensive - we just don't collide with or draw dead things

    Has strange side effect whereby floors etc need HP in order to be drawn haha

    Same as points.find( ... ) but reuse for(;;) syntax for better packing
  */
  let collides = ( points, p ) => {
    for( let i = 0; i < points.length; i++ ){
      if( 
        points[ i ][ HP ] && 
        p[ X ] === points[ i ][ X ] && 
        p[ Y ] === points[ i ][ Y ] 
      ) return points[ i ]
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
   
    let points = []
    let mobs = [ player ]

    let levelWidth = randInt( currentLevel * 25 ) + width
    let levelHeight = randInt( currentLevel * 25 ) + height
    let levelRooms = randInt( currentLevel * 25 ) + roomCount
    let levelMonsters = randInt( currentLevel * 25 ) + monsterCount

    /*
      Add a new mob, even stairs are mobs to save bytes
    */
    let addMob = ( pointType, hp, ch ) => {
      let mob = [ randInt( levelWidth ), randInt( levelHeight ), pointType, hp, ch ]
      
      /*
        Has to collide with a floor tile to be on map, but also has to be the only 
        mob at this point on the map
      */
      if( 
        collides( levels[ currentLevel ][ LEVEL_FLOORS ], mob ) && 
        !collides( levels[ currentLevel ][ LEVEL_MOBS ], mob ) 
      ){
        levels[ currentLevel ][ LEVEL_MOBS ].push( mob )

        return mob
      } 
      
      /*
        Call recursively if couldn't place, saves a while loop
      */
      return addMob( pointType, hp, ch )    
    }

    let drawRect = ( p1, p2 ) => {
      /*
        If we end up using Math.min/Math.max elsewhere it may be shorter to use 
        here too, but otherwise this ternary of horror packs better

        We have to sort the points because when we're connecting two random
        points we don't know if the second one is in the correct order

        We use <= rather than < because it allows you to reuse drawRect to also
        draw lines, saving an extra function
      */
      for( 
        let y = ( p1[ Y ] < p2[ Y ] ? p1[ Y ] : p2[ Y ] ); 
        y <= (  p1[ Y ] < p2[ Y ] ? p2[ Y ] : p1[ Y ] ); 
        y++ 
      ){
        for( 
          let x = ( p1[ X ] < p2[ X ] ? p1[ X ] : p2[ X ] ); 
          x <= (  p1[ X ] < p2[ X ] ? p2[ X ] : p1[ X ] ); 
          x++ 
        ){
          /*
            Even a floor has to have HP to get drawn
          */
          points.push( [ x, y, POINT_TYPE_FLOOR, 1, CHAR_FLOOR ] )          
        }
      }
    }
    
    // draw an L-shaped corridor between these two points
    let connect = ( p1, p2 ) => {
      drawRect( [ p1[ X ], p1[ Y ] ], [ p1[ X ], p2[ Y ] ] )
      drawRect( [ p1[ X ], p2[ Y ] ], [ p2[ X ], p2[ Y ] ] )
    } 
  
    /*
      For each room, pick a new point at random. It can be one that's already a 
      corridor or room, aside from being cheaper in bytes, it makes for more
      interesting shaped rooms if some overlap. Then connect this point randomly
      to a point already on the map to ensure we have no disconnected rooms,
      then draw a random rectangle over the top of this point to make the room
    */
    for( let i = 0; i < levelRooms; i++ ){
      /*
        Start with player
      */
      let p = i === 0 ? [ player[ X ], player[ Y ] ] : [ randInt( levelWidth ), randInt( levelHeight ) ]
    
      if( points.length ){
        connect( p, points[ randInt( points.length ) ] )
      }
    
      drawRect( 
        [ 
          p[ X ] - ( randInt( maxSize ) + minSize ),
          p[ Y ] - ( randInt( maxSize ) + minSize )
        ], 
        [ 
          p[ X ] + ( randInt( maxSize ) + minSize ),
          p[ Y ] + ( randInt( maxSize ) + minSize )
        ] 
      )
    }
    
    levels[ currentLevel ] = [ points, mobs ]

    let stairs = addMob( POINT_TYPE_STAIRS, 1, CHAR_STAIRS_DOWN )

    for( let i = 0; i < monsterCount; i++ ){
      addMob( POINT_TYPE_MONSTER, 1, CHAR_MONSTER )
    }
  } 

  Dungeon()

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
          collides( levels[ currentLevel ][ LEVEL_MOBS ], [ x, y ] ) || 
          collides( levels[ currentLevel ][ LEVEL_FLOORS ], [ x, y ] )

        /*
          A wall - # - is just an absence of anything else
        */
        c.fillText( 
          current ? current[ CHAR ] : CHAR_WALL, vX * textSize, vY * textSize 
        )
      }
    }
    c.fillText( 'L ' + currentLevel + ' HP ' + player[ HP ], 0, viewSize * textSize )
  }

  /*
    Movement for both payers and monsters
  */
  let move = ( p, which ) => {    
    /*
      set the position we're going to move to to the position we're already at
    */
    let newP = [ p[ X ], p[ Y ] ]

    /*
      Monsters, one in five chance doesn't move towards player, otherwise try to
      move closer - the if/else structure here creates very predictable movement
      but is also very cheap - the chance not to move towards player helps to
      stop monsters getting permanently stuck
    */
    if( p[ POINT_TYPE ] === POINT_TYPE_MONSTER && randInt( 5 ) ){
      if( player[ X ] < p[ X ] ){
        newP[ X ]--
      } 
      else if( player[ X ] > p[ X ] ){
        newP[ X ]++
      } 
      else if( player[ Y ] < p[ Y ] ){
        newP[ Y ]--        
      } 
      else if( player[ Y ] > p[ Y ] ){
        newP[ Y ]++
      }
    } else {
      /*
        This block is for the player, or for monsters who are moving randomly
        We use the keyboard codes for arrow keys even for monster movement, 
        it saves bytes
      */

      //up
      if( which === 1 ){
        newP[ Y ]--
      } 
      //right
      else if( which === 2 ){
        newP[ X ]++
      } 
      //down
      else if( which === 3 ){
        newP[ Y ]++
      } 
      //left
      else if( which === 0 ){
        newP[ X ]--
      }
    }
    
    /*
      See if anything is at the point we tried to move to
    */
    let point = collides( levels[ currentLevel ][ LEVEL_MOBS ], newP )

    /*
      If we're a monster and the tile we tried to move to has a player on it,
      try to hit them instead of moving there
    */
    if( 
      point && p[ POINT_TYPE ] === POINT_TYPE_MONSTER && 
      point[ POINT_TYPE ] === POINT_TYPE_PLAYER && randInt( 2 ) 
    ){
      point[ HP ]--
    } 
    /*
      Ditto for player moving onto monster
    */
    else if( 
      point && p[ POINT_TYPE ] === POINT_TYPE_PLAYER && 
      point[ POINT_TYPE ] === POINT_TYPE_MONSTER && randInt( 2 ) 
    ){
      point[ HP ]--
    }
    /*
      Go down stairs
    */
    else if( point && point[ POINT_TYPE ] === POINT_TYPE_STAIRS ){
      currentLevel++
      Dungeon()
    }
    /*
      If this is a floor tile and no mobs were here, we can move
    */
    else if( 
      collides( levels[ currentLevel ][ LEVEL_FLOORS ], newP ) && !point 
    ){
      p[ X ] = newP[ X ]
      p[ Y ] = newP[ Y ]
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
    for( let i = 0; i < levels[ currentLevel ][ LEVEL_MOBS ].length; i++ ){
      if( 
        levels[ currentLevel ][ LEVEL_MOBS ][ i ][ HP ] && 
        levels[ currentLevel ][ LEVEL_MOBS ][ i ][ POINT_TYPE ] === POINT_TYPE_MONSTER 
      ) move( levels[ currentLevel ][ LEVEL_MOBS ][ i ], randInt( 4 ) )
    }

    /*
      Stop drawing when the player dies, game over - we're not communicating 
      well here but it's so cheap. If we have room later a message would be
      better
    */
    if( player[ HP ] > 0 ){
      draw()
    }  

    /*
    // 1% chance every move of spawn monster
    if( !randInt( 100 ) ){
      monsters.push( addMob( POINT_TYPE_MONSTER, 1, 'm' ) )         
    } 
    */
  }

  draw()    
}

G()