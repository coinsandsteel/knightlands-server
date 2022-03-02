export class HpClass {
  protected _hp: number;
  protected _previousHp: number;
  protected _maxHp: number;

  get hp(): number {
    return this._hp;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  public modifyHp(value: number): void {
    this._hp += value;
    if (this._hp <= 0) {
      this.destroy();
    }
  };

  public modifyMaxHp(value: number): void {
    this._maxHp += value;
  };

  public isDead(): boolean {
    return this._hp <= 0;
  };
  
  public destroy(): void {};
}