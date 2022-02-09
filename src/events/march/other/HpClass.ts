export class HpClass {
  protected _hp: number;
  get hp(): number {
    return this._hp;
  }
  public modifyHp(value: number): void {
    this._hp += value;
    if (this._hp <= 0) {
      this.destroy();
    }
  };
  public destroy(): void {};
  public isDead(): boolean {
    return this._hp <= 0;
  };
}