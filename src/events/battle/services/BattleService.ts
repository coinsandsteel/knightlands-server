
export class BattleService {
  public log(message: string, payload?: any) {
    //if (process.env.ENV === "development") {
      console.log(`[${this.constructor.name}] ${message}`, payload);
    //}
  }
}