import { Magic } from "@magic-sdk/admin";
const magic = new Magic("sk_live_EDED532890E6D1F4");

export async function getUserMetadata(token: string) {
    return magic.users.getMetadataByToken(token);
}

export async function decodeToken(token) {
    return magic.token.decode(token);
}
