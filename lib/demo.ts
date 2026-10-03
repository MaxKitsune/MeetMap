import { db } from "./db";
import { saveImage, removeImage } from "./uploads";
import { ApiError } from "./security";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function seedDemo(ownerId: string) {
  if (
    (await db.person.count({ where: { ownerId } })) ||
    (await db.memory.count({ where: { ownerId } }))
  )
    throw new ApiError(
      409,
      "Beispieldaten sind nur in einem leeren Bereich verfügbar.",
    );
  const imageNames = ["lake-como", "dolomites", "cafe"];
  const files: Awaited<ReturnType<typeof saveImage>>[] = [];
  try {
    for (const name of imageNames)
      files.push(
        await saveImage(
          await readFile(
            path.join(process.cwd(), "assets/demo", name + ".jpg"),
          ),
          name + ".jpg",
          ownerId,
        ),
      );
    await db.$transaction(
      async (tx) => {
        if (
          (await tx.person.count({ where: { ownerId } })) ||
          (await tx.memory.count({ where: { ownerId } }))
        )
          throw new ApiError(409, "Der Bereich enthält bereits Einträge.");
        const today = new Date();
        const past = (days: number) =>
          new Date(
            Date.UTC(
              today.getUTCFullYear(),
              today.getUTCMonth(),
              today.getUTCDate() - days,
            ),
          );
        const birthday = (days: number, year: number) => {
          const d = past(-days);
          return new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()));
        };
        const places = await Promise.all(
          [
            { name: "Comer See, Italien", latitude: 46.016, longitude: 9.257 },
            {
              name: "Dolomiten, Südtirol",
              latitude: 46.498,
              longitude: 11.829,
            },
            {
              name: "München, Deutschland",
              latitude: 48.137,
              longitude: 11.576,
            },
            { name: "Berlin, Deutschland", latitude: 52.52, longitude: 13.405 },
            { name: "Wien, Österreich", latitude: 48.208, longitude: 16.373 },
          ].map((p) => tx.place.create({ data: { ownerId, ...p } })),
        );
        const people = [];
        const names = [
          "Lena Fischer",
          "Jonas Weber",
          "Mia Schneider",
          "Ben Hoffmann",
          "Sophie Bauer",
          "Noah Winter",
        ];
        for (let i = 0; i < names.length; i++)
          people.push(
            await tx.person.create({
              data: {
                ownerId,
                name: names[i],
                aliases: i === 0 ? "Leni" : "",
                tags: [i === 2 ? "Familie" : "Freundschaft"],
                importance: i < 2 ? 3 : 2,
                favorite: i < 3,
                metAt: past(420 + i * 180),
                lastContact: past([42, 35, 11, 62, 8, 3][i]),
                contactDays: 30,
                birthday: birthday([5, 48, 14, 83, 29, 132][i], 1994 + i),
                notes: [
                  "Kennt die besten kleinen Cafés. Wir können stundenlang über alles reden.",
                  "Immer für eine Wanderung zu haben. Liebt die Berge und guten Kaffee.",
                  "Gemeinsame Sonntage, lange Gespräche und viele kleine Traditionen.",
                  "Wir haben uns auf einer Reise kennengelernt.",
                  "Hat immer eine gute Buchempfehlung.",
                  "Unser Kontakt begann mit einem gemeinsamen Online-Projekt.",
                ][i],
                online: i === 5,
                platform: i === 5 ? "Discord" : "",
                placeId: i === 5 ? null : places[[2, 2, 3, 4, 2][i]].id,
              },
            }),
          );
        const sample = [
          {
            title: "Ein Wochenende am Comer See",
            content:
              "Morgens barfuß auf der Terrasse, der See noch ganz still. Lena hat Kaffee gemacht, Jonas die erste Fähre entdeckt.\n\nWir sind ohne Plan durch die kleinen Gassen gelaufen und bis zum Sonnenuntergang am Wasser geblieben. Einer dieser Tage, die man am liebsten in ein Glas füllen würde.",
            startAt: past(4),
            endAt: past(2),
            type: "Reise",
            mood: "Glücklich",
            placeId: places[0].id,
            people: [people[0].id, people[1].id],
            favorite: true,
            pinned: false,
          },
          {
            title: "Über den Wolken",
            content:
              "Früh losgelaufen und oben mit dieser Aussicht belohnt worden. Die letzte Steigung hatte es in sich.\n\nAm Gipfel gab es belegte Brote und lange Stille. Mit Jonas muss man nicht jede Pause mit Worten füllen.",
            startAt: past(12),
            endAt: null,
            type: "Reise",
            mood: "Dankbar",
            placeId: places[1].id,
            people: [people[1].id],
            favorite: false,
            pinned: false,
          },
          {
            title: "Kaffee, Croissants & gute Gespräche",
            content:
              "Unser Lieblingsplatz am Fenster war frei. Aus einem schnellen Kaffee wurden drei Stunden.\n\nMia hat von ihren neuen Plänen erzählt. Schön zu sehen, wie viel Mut manchmal in einem kleinen nächsten Schritt steckt.",
            startAt: past(18),
            endAt: null,
            type: "Treffen",
            mood: "Entspannt",
            placeId: places[2].id,
            people: [people[2].id],
            favorite: true,
            pinned: false,
          },
        ];
        for (let i = 0; i < sample.length; i++) {
          const { people: ids, ...m } = sample[i];
          await tx.memory.create({
            data: {
              ...m,
              ownerId,
              people: { connect: ids.map((id) => ({ id })) },
              attachments: { connect: { id: files[i].id } },
            },
          });
        }
        await tx.auditLog.create({
          data: { ownerId, action: "DEMO_IMPORTED" },
        });
      },
      { isolationLevel: "Serializable", timeout: 20000 },
    );
  } catch (e) {
    await db.attachment.deleteMany({
      where: { id: { in: files.map((f) => f.id) }, ownerId },
    });
    await Promise.all(files.map((f) => removeImage(f.storageKey)));
    throw e;
  }
}
