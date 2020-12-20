import { Magic } from "@magic-sdk/admin";
const magic = new Magic("sk_test_2A5BB59B351FF7C4");

export async function getUserMetadata(token: string) {
    return magic.users.getMetadataByToken(token);
}

export async function decodeToken(token) {
    return magic.token.decode(token);
}
