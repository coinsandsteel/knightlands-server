export class HpClass {
  protected hp: number;
  constructor(){
    this.setInitialHP();
  }
  protected setInitialHP(): void {};
  public modifyHp(value: number): void {
    this.hp += value;
    if (this.hp <= 0) {
      this.destroy();
    }
  };
  public destroy(): void {};
  public isDead(): boolean {
    return this.hp <= 0;
  };
}