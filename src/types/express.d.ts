import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        username: string;
        email: string;
        staffRole: string;
        administrator: import("../models/User.js").AdministratorTypes;
      };
    }
  }
}
