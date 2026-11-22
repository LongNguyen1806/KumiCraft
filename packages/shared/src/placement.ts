// Free placement of an element in a free frame (R-FF-10, R-FF-11): the contract the Bridge, the
// Studio and the server share. The Tailwind classes for it are made by @kumicraft/style-tailwind.
import { z } from 'zod';

export type FreeBox = {
  readonly left: number;
  readonly top: number;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
};

export const FreeBoxSchema = z.strictObject({
  left: z.number(),
  top: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PlacementSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('free'),
    left: z.number(),
    top: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.strictObject({
    kind: z.literal('flow'),
  }),
]);
export type Placement = z.infer<typeof PlacementSchema>;
