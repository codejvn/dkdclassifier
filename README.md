# Invera

Most at-risk patients aren’t screened for kidney disease until it’s too late. Invera uses glucose data to detect risk and flag patients instantly—turning passive data into actionable insight.

Video Presentation: https://youtu.be/QZQl2pZfwvQ

Google Slides: https://docs.google.com/presentation/d/16BqCawGRC2kVRiTqwJXHL8l2Hx0C_-0a/edit?usp=sharing&ouid=116085661787561221330&rtpof=true&sd=true

`presentation.html` --> HTML version of the presentation

Hack Princeton Spring 2026

## Tech Stack

**Backend:**
* **Framework:** FastAPI (Python)
* **Machine Learning:** XGBoost, Pandas, NumPy
* **Agentic Mapping:** Google Generative AI (Gemini 2.5 Flash)
* **Hosting:** Hugging Face Spaces

**Frontend:**
* **Framework:** React + Vite
* **Data Visualization:** Recharts
* **Hosting:** Vercel / Netlify

## The Architecture Pipeline

1. **Upload:** User drops a raw patient CGM file (`.csv`) into the React UI.
2. **Semantic Cleanse:** FastAPI sends the CSV headers to Gemini, which returns the exact index of the glucose data, ignoring proprietary hardware naming conventions.
3. **Feature Extraction:** Pandas calculates `mean_glucose`, `glucose_std`, `cv_glucose`, `time_above_range`, `time_below_range`, and `time_in_range`.
4. **Regex Demographics:** Age and Sex are dynamically scraped from the CSV headers.
5. **Inference:** The XGBoost Classifier scores the risk. 
6. **Payload Construction:** The backend returns the score, the demographics, the 6 features, and an Array of Objects to instantly render the Recharts graph on the frontend.

## Acknowledgements

The raw data + data cleaning files were compiled from the GlucoBench
repository. The files used from the repo can be found in the
data-and-cleaning/GlucoBench folder

@article{sergazinov2024glucobench,
  author  = {Renat Sergazinov and Elizabeth Chun and Valeriya Rogovchenko and Nathaniel Fernandes and Nicholas Kasman and Irina Gaynanova},
  title   = {GlucoBench: Curated List of Continuous Glucose Monitoring Datasets with Prediction Benchmarks},
  journal = {arXiv preprint arXiv:2410.05780},
  year    = {2024},
  url     = {https://arxiv.org/abs/2410.05780}
}

We also used a dataset from the "Chinese diabetes datasets for data-driven machine learning" paper.

@article{zhao2023chinese,
  title={Chinese diabetes datasets for data-driven machine learning},
  author={Zhao, Qinpei and Zhu, Jinhao and Shen, Xuan and Lin, Chuwen and Zhang, Yinjia and Liang, Yuxiang and Cao, Baige and Li, Jiangfeng and Liu, Xiang and Rao, Weixiong and Wang, Congrong},
  journal={Scientific Data},
  volume={10},
  number={1},
  pages={35},
  year={2023},
  publisher={Nature Publishing Group}
}
