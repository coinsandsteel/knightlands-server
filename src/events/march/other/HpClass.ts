export class HpClass {
  protected hp: number;
  protected initialHp: number;
  public modifyHp(value: number, modifier: any = null): void {
    this.hp += value;
    if (this.hp <= 0) {
      this.destroy();
    }
  };
  public setHP(value: number): void {
    this.hp = value;
    this.initialHp = value;
  };
  public getHP(): number {
    return this.hp;
  };
  public destroy(): void {};
  public isDead(): boolean {
    return this.hp <= 0;
  };
}