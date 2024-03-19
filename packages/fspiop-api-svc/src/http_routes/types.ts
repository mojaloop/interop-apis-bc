import { FastifyRequest, FastifyReply } from 'fastify';

type ById = {
    id: string;
};

type ApiRequest<Body = void, Params = void> = {
    Body: Body;
    Params: Params;
    Reply: { data?: any & ById; message?: string };
};

type ApiResponse<Body = void, Params = void> = FastifyReply & {
    Request: FastifyRequest<ApiRequest<Body, Params>>;
};

type RouteHandlerMethod<Body = void, Params = void> = (
    request: FastifyRequest<ApiRequest<Body, Params>>,
    response: ApiResponse<Body, Params>
) => void;

export type GetRequestHandler<ReplyPayload = ById> = RouteHandlerMethod<void, ById>;
export type DeleteRequestHandler<ReplyPayload = ById> = RouteHandlerMethod<void, ById>;
export type PostRequestHandler<Payload, ReplyPayload> = RouteHandlerMethod<Payload, void>;
export type PatchRequestHandler<Payload, ReplyPayload> = RouteHandlerMethod<Payload, ById>;
export type PutRequestHandler<Payload, ReplyPayload> = RouteHandlerMethod<Payload, ById>;