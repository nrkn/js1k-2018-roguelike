# Mines of Crypto Roguelike JS1K 2018 Development

I knew that a simple roguelike was possible having produced one for
[JS1k 2010](http://js1k.com/2010-first/demo/769)

Although a full game, with win and lose mechanics, level progression etc I was
never entirely happy with it

What I really wanted this time was a roguelike that felt like a roguelike

I particularly wanted a better dungeon generator this time around, and for it
to use classic roguelike graphics, eg this kind of thing:

```
###########   #######
#....!....#####.m...#
#.@...............>.#
#......!..#####.....#
###########   #######
``

My process this time around was:

- Made a desired feature list
- Implemented each feature then checked minified+packed size
- Golfed promising features until they fitted in 1k, or abandoned if it seemed
  undoable

I Used [branches](https://github.com/nrkn/js1k-2018-roguelike/branches/active)
to try out new features

## Features

Initially I made a list of features that I wanted - I knew that not all of them
would be possible in 1k, and that I'd have to prioritise:

- decent dungeons that look like dungeons
- monsters and combat
- multiple dungeon levels with difficulty progression
- healing potions
- win if reach bottom
- fov
- colors
- move up and down stairs
- multiple monster types
- emoji
- weapons/armor
- win if reach bottom and return to top
- gold
- shop (level 0) - only fun if weight limit on carrying items and can sell then
  use money to buy better armour, weapons

### Decent Dungeons

I played with [BSP](http://www.roguebasin.com/index.php?title=Basic_BSP_Dungeon_generation)
and was able to do a decent BSP dungeon generator with the player `@` walking
around, but with very few bytes left over