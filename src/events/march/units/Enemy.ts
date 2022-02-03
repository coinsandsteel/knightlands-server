export class Enemy {
  /*
  - .tier = 1-4
  - .type
    - Guard
      - .hp = ???
    - Boss
      - .hp = ???
    - Trap
      - .tier = 1-2
      - .hp = ???
  - .touch()
    - Guard, Boss > Fight
      - Guard > Success > .revealLoot() > Pet.restoreHealth() ???
      - Success > .revealLoot() > Pet.restoreHealth()
      - Fail > .exit()
    - Trap > Add penalty to pet
  - .revealLoot()
    - ???
  - .destroy()
    - ???
  */
}