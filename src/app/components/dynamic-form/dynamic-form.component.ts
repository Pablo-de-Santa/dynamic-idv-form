import { Component, OnInit, OnDestroy, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from "@angular/forms";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatInputModule } from "@angular/material/input";
import { MatNativeDateModule } from "@angular/material/core";
import { MatDatepickerToggle } from "@angular/material/datepicker";
import { ScrollingModule } from "@angular/cdk/scrolling";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Flip from "gsap/Flip";
import Draggable from "gsap/Draggable";

const JSON_CONFIG_URL = "assets/form-config.json";

@Component({
  selector: "app-dynamic-form",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    ScrollingModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDatepickerToggle,
  ],
  templateUrl: "./dynamic-form.component.html",
  styleUrls: ["./dynamic-form.component.scss"],
})
export class DynamicFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  idvForm: FormGroup = this.fb.group({
    selectedBank: ["", Validators.required],
  });

  formConfig: any = {};
  bankNames: string[] = [];
  filteredBankNames: string[] = [];
  searchText: string = "";
  searchText$: Subject<string> = new Subject<string>();
  submittedData: any = null;
  showSummary: boolean = false;

  private destroy$ = new Subject<void>();

  isSubmitting: boolean = false;
  resizeTimeout!: ReturnType<typeof setTimeout>;
  isSubmittedSuccessfully = false;

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadFormConfig();

    this.searchText$
      .pipe(debounceTime(500))
      .subscribe((searchText) => {
        this.filterBanks(searchText);
      });
  }

  getKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  loadFormConfig() {
    this.http.get<any>(JSON_CONFIG_URL).subscribe((config) => {
      this.formConfig = config;
      this.bankNames = Object.keys(config);
      this.filteredBankNames = [...this.bankNames];
    });
  }

  onSearchInput(event: Event) {
    const input = (event.target as HTMLInputElement).value;
    this.searchText$.next(input);
  }

  filterBanks(searchText: string) {
    const searchLower = searchText.toLowerCase();
    this.filteredBankNames = this.bankNames.filter((bank) =>
      bank.toLowerCase().includes(searchLower)
    );
  }

  onBankChange() {
    const selectedBank = this.idvForm.get("selectedBank")?.value;
    if (selectedBank) {
      this.buildForm(this.formConfig[selectedBank]);
    } else {
      this.idvForm.reset();
    }
  }

  buildForm(bankConfig: any) {
    const group: any = {
      selectedBank: [
        this.idvForm.get("selectedBank")?.value,
        Validators.required,
      ],
    };

    Object.keys(bankConfig).forEach((identity) => {
      const identityGroup: any = {};

      bankConfig[identity]
        .sort((a: any, b: any) => a.order - b.order)
        .forEach((field: any) => {
          identityGroup[field.label] = ["", this.getValidators(field)];
        });

      group[identity] = this.fb.group(identityGroup);
    });

    this.idvForm = this.fb.group(group);
  }

  getFormGroup(control: AbstractControl | null): FormGroup | null {
    return control instanceof FormGroup ? control : null;
  }

  getValidators(field: any): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (field.required) {
      validators.push(Validators.required);
    }

    if (field.validation) {
      const rules = field.validation.split("|");
      rules.forEach((rule: string) => {
        if (rule.startsWith("maxlength=")) {
          const maxLength = parseInt(rule.split("=")[1], 10);
          validators.push(Validators.maxLength(maxLength));
        }
        if (rule === "digits") {
          if (!rules.includes("special=-")) {
            validators.push(this.digitsValidator());
          }
        }
        if (rule === "special=-") {
          validators.push(this.digitsWithDashValidator());
        }
        if (rule === "past-date") {
          validators.push(this.pastDateValidator());
        }
        if (rule === "future-date") {
          validators.push(this.futureDateValidator());
        }
        if (rule === "valid-province") {
          validators.push(this.validProvinceValidator());
        }
      });
    }

    return validators;
  }

  digitsWithDashValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const regex = /^[0-9]+(-[0-9]+)*$/;
      return control.value && !regex.test(control.value)
        ? { invalidFormat: true }
        : null;
    };
  }

  pastDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const date = new Date(control.value);
      return control.value && date >= new Date() ? { pastDate: true } : null;
    };
  }

  futureDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const date = new Date(control.value);
      return control.value && date <= new Date() ? { futureDate: true } : null;
    };
  }

  validProvinceValidator(): ValidatorFn {
    const validProvinces = [
      "AB",
      "BC",
      "MB",
      "NB",
      "NL",
      "NS",
      "ON",
      "PE",
      "QC",
      "SK",
    ];
    return (control: AbstractControl): ValidationErrors | null => {
      return control.value && !validProvinces.includes(control.value)
        ? { invalidProvince: true }
        : null;
    };
  }

  digitsValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const regex = /^[0-9]+$/;
      return control.value && !regex.test(control.value)
        ? { digits: true }
        : null;
    };
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.isSubmitting = true;

    this.idvForm.markAllAsTouched();

    if (this.idvForm.invalid) {
      this.snackBar.open("Please fill out all required fields.", "Close", {
        duration: 4000,
      });
      this.shakeForm();
      this.isSubmitting = false;
      return;
    }

    this.snackBar.open("Form submitted successfully!", "Close", {
      duration: 3000,
    });

    this.submittedData = this.idvForm.value;

    this.suckInForm(() => {
      this.explodeParticles(() => {
        this.isSubmitting = false;
        this.showSummary = true;
      });
    });
  }

  ngAfterViewInit() {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger, Flip, Draggable);
      gsap.from(".form", { duration: 1, y: -50, opacity: 0, ease: "bounce" });
      gsap.from(".inputGroup", {
        duration: 0.5,
        y: -30,
        opacity: 0,
        stagger: 0.3,
        delay: 0.75,
        ease: "bounce",
      });

      this.initializeParticles();
      window.addEventListener("resize", this.onResize.bind(this));
    }
  }

  ngOnDestroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onResize.bind(this));
      clearTimeout(this.resizeTimeout);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  onResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.initializeParticles();
    }, 500);
  }

  suckInForm(callback: () => void) {
    const form = document.querySelector(".form") as HTMLElement | null;

    if (form) {
      gsap.to(form, {
        x:
          window.innerWidth / 2 -
          form.offsetWidth / 2 -
          form.getBoundingClientRect().left,
        y:
          window.innerHeight / 2 -
          form.offsetHeight / 2 -
          form.getBoundingClientRect().top,
        scale: 0,
        opacity: 0,
        duration: 1.5,
        ease: "power4.in",
        onComplete: callback,
      });
    } else {
      console.error("The form element was not found!");
    }
  }

  shakeForm() {
    const form = document.querySelector(".form") as HTMLElement | null;
    if (form) {
      this.isSubmitting = true;
      gsap.to(form, {
        x: "+=10",
        ease: 'rough({ strength: 8, points: 20, template: linear, taper: "none", randomize: true })',
        repeat: 3,
        yoyo: true,
        duration: 0.25,
        onComplete: () => {
          this.isSubmitting = false;
        },
      });
    } else {
      console.error("The form element was not found!");
    }
  }

  explodeParticles(onCompleteCallback?: () => void) {
    const particles = document.querySelectorAll(".particle");
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    gsap.killTweensOf(particles);

    const tl = gsap.timeline({
      onComplete: onCompleteCallback,
    });

    tl.to(particles, {
      duration: 1,
      x: centerX,
      y: centerY,
      ease: "power4.in",
      stagger: {
        amount: 0.5,
      },
    }).to(particles, {
      scale: () => 1 + particles.length / 300,
      duration: 0.5,
      ease: "none",
    });

    for (let i = 0; i < 5; i++) {
      tl.to(particles, { x: `+=${gsap.utils.random(-5, 5)}`, duration: 0.05 })
        .to(particles, { x: `-=${gsap.utils.random(-5, 5)}`, duration: 0.05 })
        .to(particles, { y: `+=${gsap.utils.random(-5, 5)}`, duration: 0.05 })
        .to(particles, { y: `-=${gsap.utils.random(-5, 5)}`, duration: 0.05 });
    }

    tl.to(particles, {
      duration: 2,
      x: `random(0, ${window.innerWidth})`,
      y: `random(0, ${window.innerHeight})`,
      scale: `random(0.5, 1.5)`,
      opacity: 0,
      ease: "power4.out",
      stagger: {
        amount: 1,
      },
    });
  }

  initializeParticles() {
    const particlesContainer = document.querySelector(".particles");
    if (particlesContainer) {
      particlesContainer.innerHTML = "";
      for (let i = 0; i < 200; i++) {
        let particle = document.createElement("div");
        particle.className = "particle";
        particlesContainer.appendChild(particle);
        gsap.fromTo(
          particle,
          {
            x: gsap.utils.random(0, window.innerWidth),
            y: gsap.utils.random(0, window.innerHeight),
            opacity: 0.5,
            scale: `random(0.5, 1)`,
          },
          {
            duration: `random(5, 20)`,
            x: gsap.utils.random(0, window.innerWidth),
            y: gsap.utils.random(0, window.innerHeight),
            repeat: -1,
            yoyo: true,
            ease: "none",
          }
        );
      }
    } else {
      console.error("The particles container was not found.");
    }
  }

  hasSubmitted(): void {
    if (this.isSubmittedSuccessfully) {
      this.snackBar.open("Thank you! Submitted", "Close"),
        {
          verticalPosition: "top",
          duration: 3500,
          panelClass: ["successSnackbar"],
        };
    } else {
      this.snackBar.open("Oops...something went wrong", "Close"),
        {
          verticalPosition: "top",
          duration: 0,
          panelClass: ["errorSnackbar"],
        };
    }
  }
}
