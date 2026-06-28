import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/room.entity';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async create(createRoomDto: CreateRoomDto) {
    const room = this.roomRepository.create(createRoomDto);

    return await this.roomRepository.save(room);
  }

  async findAll() {
    return await this.roomRepository.find({
      order: {
        id: 'DESC',
      },
    });
  }

  async findOne(id: number) {
    return await this.roomRepository.findOne({
      where: { id },
    });
  }

  async update(id: number, updateRoomDto: UpdateRoomDto) {
    await this.roomRepository.update(id, updateRoomDto);

    return this.findOne(id);
  }

  async remove(id: number) {
    const room = await this.findOne(id);

    if (!room) {
      return {
        message: 'Room not found',
      };
    }

    await this.roomRepository.delete(id);

    return {
      message: 'Room deleted successfully',
    };
  }
}