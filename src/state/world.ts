/**
 * World state — rooms and connections between them.
 *
 * This is a minimal stub world representing the Solaris Starport arrival area
 * (mentioned in the readme as the "New Player Walkthrough" starting point).
 *
 * Room layout is entirely fictional until the server protocol is understood
 * well enough to reconstruct the actual Solaris map.
 */

export interface Exit {
  direction: 'north' | 'south' | 'east' | 'west';
  description: string;
  targetRoomId: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: Exit[];
  /** Session IDs of players currently in this room. */
  players: string[];
}

export class World {
  private rooms = new Map<string, Room>();

  constructor() {
    this.buildStarterWorld();
  }

  private buildStarterWorld(): void {
    // Solaris Starport — arrival lobby
    this.addRoom({
      id: 'starport_arrival',
      name: 'Solaris Starport Arrival',
      description: 'The busy arrival hall of the Solaris starport. MechWarriors mill about.',
      exits: [
        {
          direction: 'north',
          description: 'the main concourse',
          targetRoomId: 'starport_concourse',
        },
      ],
      players: [],
    });

    // Main concourse — connecting hub
    this.addRoom({
      id: 'starport_concourse',
      name: 'Solaris Starport Concourse',
      description:
        'The wide concourse of Solaris City starport. Shops and stables line the walls.',
      exits: [
        {
          direction: 'south',
          description: 'the arrival hall',
          targetRoomId: 'starport_arrival',
        },
        {
          direction: 'north',
          description: 'the mech bay entrance',
          targetRoomId: 'mech_bay',
        },
      ],
      players: [],
    });

    // Mech bay — placeholder
    this.addRoom({
      id: 'mech_bay',
      name: 'Mech Bay Entrance',
      description: 'The entrance to the public mech bays. Technicians work on various mechs.',
      exits: [
        {
          direction: 'south',
          description: 'the concourse',
          targetRoomId: 'starport_concourse',
        },
      ],
      players: [],
    });
  }

  private addRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  get startRoomId(): string {
    return 'starport_arrival';
  }

  movePlayer(sessionId: string, fromRoomId: string, toRoomId: string): boolean {
    const from = this.rooms.get(fromRoomId);
    const to = this.rooms.get(toRoomId);
    if (!from || !to) return false;

    from.players = from.players.filter(id => id !== sessionId);
    to.players.push(sessionId);
    return true;
  }

  addPlayerToRoom(sessionId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room && !room.players.includes(sessionId)) {
      room.players.push(sessionId);
    }
  }

  removePlayerFromRoom(sessionId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.players = room.players.filter(id => id !== sessionId);
    }
  }
}
