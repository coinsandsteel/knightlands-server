export class HpClass {
  protected hp: number;
  public modifyHp(value: number): void {
    this.hp += value;
    if (this.hp <= 0) {
      this.destroy();
    }
  };
  public setHP(value: number): void {
    this.hp = value;
  };
  public destroy(): void {};
  public isDead(): boolean {
    return this.hp <= 0;
  };
}