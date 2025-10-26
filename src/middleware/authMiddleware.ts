import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AdministratorTypes } from "../models/User.js";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";


interface UserPayload {
  id: string;
  username: string;
  email: string;
  staffRole: string;
  administrator: AdministratorTypes;
}
export interface AuthRequest extends Request {
  userId?: string;
  user?: UserPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Không có token người dùng tìm thấy" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.id;
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      staffRole: decoded.staffRole, // fallback
      administrator: decoded.administrator as AdministratorTypes,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Hãy thử đăng nhập lại" });
  }
}

// import { Request, Response, NextFunction, RequestHandler } from "express";
// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// export interface AuthRequest extends Request {
//   userId?: string;
//   user?: { id: string; username: string; email: string; staffRole: string };
// }

// export const authMiddleware: RequestHandler = (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ message: "Không có token người dùng tìm thấy" });
//   }

//   const token = authHeader.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET) as any;

//     (req as AuthRequest).userId = decoded.id;
//     (req as AuthRequest).user = {
//       id: decoded.id,
//       username: decoded.username,
//       email: decoded.email,
//       staffRole: decoded.staffRole,
//     };

//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Hãy thử đăng nhập lại" });
//   }
// };

// import { Request, Response, NextFunction } from "express";
// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ message: "Không có token người dùng tìm thấy" });
//   }

//   const token = authHeader.split(" ")[1];

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET) as any;

//     req.userId = decoded.id;
//     req.user = {
//       id: decoded.id,
//       username: decoded.username,
//       email: decoded.email,
//       staffRole: decoded.staffRole,
//     };

//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Hãy thử đăng nhập lại" });
//   }
// };
