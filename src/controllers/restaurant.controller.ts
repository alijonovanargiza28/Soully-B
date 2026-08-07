import { NextFunction, Request, Response } from "express";
import { T } from "../libs/types/common";
import MemberService from "../models/Member.service";
import { AdminRequest, MemberInput, LoginInput } from "../libs/types/member";
import { MemberType } from "../libs/enums/member.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";

const memberService = new MemberService();

const restaurantController: T = {};

// ================= HOME =================

restaurantController.goHome = (req: AdminRequest, res: Response) => {
  try {
    console.log("HOME SESSION:", req.session.member);

    if (!req.session?.member) {
      return res.redirect("/admin/login");
    }

    return res.render("dashboard", {
      member: req.session.member,
      active: "dashboard",
    });
  } catch (err) {
    console.log("Error, goHome", err);
    return res.redirect("/admin/login");
  }
};
// ================= SIGNUP PAGE =================

restaurantController.getSignup = (req: AdminRequest, res: Response) => {
  try {
    return res.render("signup", {
      member: null,
      active: "signup",
    });
  } catch (err) {
    console.log("Error, getSignup", err);
    return res.redirect("/admin");
  }
};

// ================= LOGIN PAGE =================

restaurantController.getLogin = (req: AdminRequest, res: Response) => {
  try {
    return res.render("login", {
      member: null,
      active: "login",
    });
  } catch (err) {
    console.log("Error, getLogin", err);
    return res.redirect("/admin/login");
  }
};


// ================= SIGNUP =================

restaurantController.processSignup = async (
  req: AdminRequest,
  res: Response,
) => {
  try {
    console.log("processSignup");
    console.log("req.body", req.body);

    const file = req.file;

    if (!file) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.SOMETHING_WENT_WRONG);
    }

    const newMember: MemberInput = req.body;

    newMember.memberImage = file.path;
    newMember.memberType = MemberType.RESTAURANT;

    const result = await memberService.processSignup(newMember);

    req.session.member = result;

    req.session.save((err) => {
      if (err) {
        console.log("Session save error:", err);
        return res.redirect("/admin/login");
      }

      return res.redirect("/admin/product/all");
    });
  } catch (err) {
    console.log("Error, processSignup", err);

    const message =
      err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;

    return res.send(`
      <script>
        alert("${message}");
        window.location.replace("/admin/signup");
      </script>
    `);
  }
};

// ================= LOGIN =================

restaurantController.processLogin = async (
  req: AdminRequest,
  res: Response,
) => {
  try {
    console.log("processLogin");

    const input: LoginInput = req.body;

    const result = await memberService.processLogin(input);

    req.session.member = result;

    req.session.save((err) => {
      if (err) {
        console.log("Session save error:", err);
        return res.redirect("/admin/login");
      }

      return res.redirect("/admin/product/all");
    });
  } catch (err) {
    console.log("Error, processLogin", err);

    const message =
      err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;

    return res.send(`
      <script>
        alert("${message}");
        window.location.replace("/admin/login");
      </script>
    `);
  }
};

// ================= LOGOUT =================

restaurantController.logout = (req: AdminRequest, res: Response) => {
  console.log("LOGOUT BEFORE:", req.session.member);

  req.session.destroy((err) => {
    if (err) {
      console.log("LOGOUT ERROR:", err);
      return res.redirect("/admin/login");
    }

    console.log("LOGOUT SUCCESS");

    res.clearCookie("connect.sid");

    return res.redirect("/admin/login");
  });
};
// ================= USERS =================

restaurantController.getUsers = async (req: AdminRequest, res: Response) => {
  try {
    console.log("getUsers");

    const result = await memberService.getUsers();

    console.log("result", result);

    return res.render("users", {
      users: result,
      member: req.session?.member || null,
      active: "users",
    });
  } catch (err) {
    console.log("Error, getUsers", err);
    return res.redirect("/admin");
  }
};

// ================= UPDATE USER =================

restaurantController.updateChosenUser = async (req: Request, res: Response) => {
  try {
    console.log("updateChosenUser");

    const result = await memberService.updateChosenUser(req.body);

    return res.status(HttpCode.OK).json({
      data: result,
    });
  } catch (err) {
    console.log("Error, updateChosenUser", err);

    if (err instanceof Errors) {
      return res.status(err.code).json(err);
    }

    return res.status(Errors.standard.code).json(Errors.standard);
  }
};

// ================= CHECK AUTH SESSION =================

restaurantController.checkAuthSession = async (
  req: AdminRequest,
  res: Response,
) => {
  try {
    console.log("checkAuthSession");

    if (req.session?.member) {
      return res.send(`
        <script>
          alert("${req.session.member.memberNick}");
        </script>
      `);
    }

    return res.send(`
      <script>
        alert("${Message.NOT_AUTHENTICATED}");
      </script>
    `);
  } catch (err) {
    console.log("Error, checkAuthSession", err);
    return res.send(err);
  }
};

// ================= VERIFY RESTAURANT =================

restaurantController.verifyRestaurant = (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.session?.member?.memberType === MemberType.RESTAURANT) {
    req.member = req.session.member;

    return next();
  } else {
    const message = Message.NOT_AUTHENTICATED;

    return res.send(`
      <script>
        alert("${message}");
        window.location.replace("/admin/login");
      </script>
    `);
  }
};

export default restaurantController;
