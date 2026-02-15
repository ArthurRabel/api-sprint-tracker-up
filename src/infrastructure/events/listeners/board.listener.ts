import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { BoardGateway } from '../board.gateway';

interface BoardModifiedPayload {
  boardId: string;
  action: string;
  at: string;
  [key: string]: string | number | boolean;
}

@Injectable()
export class BoardListener {
  constructor(private readonly boardGateway: BoardGateway) {}

  @OnEvent('board.modified')
  handleBoardModified(payload: BoardModifiedPayload): void {
    this.boardGateway.emitModifiedInBoard(payload.boardId, payload);
  }
}
